// @vitest-environment jsdom
// Tests of plan-ui_transitions, batch cascading-lists: ListPresence spec.
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type PresentItem, useListPresence } from './list-presence';

const ENTER_MS = 80;
const EXIT_MS = 80;

interface Item {
  id: string;
  value: string;
}

let root: Root | undefined;
let latest: readonly PresentItem<Item>[] = [];

function Probe({ items }: { items: Item[] | undefined }) {
  latest = useListPresence(items, (item) => item.id);
  return null;
}

const render = (items: Item[] | undefined) => flushSync(() => root?.render(<Probe items={items} />));
const item = (id: string, value = id): Item => ({ id, value });
const of = (...ids: string[]) => ids.map((id) => item(id));
const view = () => latest.map((entry) => `${entry.key}:${entry.phase}`);
const phaseOf = (key: string) => latest.find((entry) => entry.key === key)?.phase;
const setTokens = (enter: string | null, exit: string | null) => {
  const style = document.documentElement.style;
  if (enter === null) style.removeProperty('--motion-duration-enter');
  else style.setProperty('--motion-duration-enter', enter);
  if (exit === null) style.removeProperty('--motion-duration-exit');
  else style.setProperty('--motion-duration-exit', exit);
};
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  setTokens(`${ENTER_MS}ms`, `${EXIT_MS}ms`);
  root = createRoot(document.createElement('div'));
});

afterEach(() => {
  root?.unmount();
  root = undefined;
  latest = [];
  document.documentElement.removeAttribute('style');
});

describe('useListPresence', () => {
  // ListPresence "Contract": undefined items (loading) give an empty result
  it('gives an empty result while the items are undefined', () => {
    render(undefined);
    expect(latest).toEqual([]);
  });

  // ListPresence "Contract": the appearance shows every item, with no enter
  it('gives every item of the first defined items the phase shown, in order', () => {
    render(undefined);
    render(of('a', 'b', 'c'));
    expect(view()).toEqual(['a:shown', 'b:shown', 'c:shown']);
    expect(latest[1]?.item).toEqual(item('b'));
  });

  // plan-ui_transitions/REQ-18: a new item enters, then is shown
  it('gives a new item the phase entering for the enter duration, then shown', async () => {
    render(of('a'));
    render(of('a', 'new'));
    expect(phaseOf('new')).toBe('entering');
    expect(phaseOf('a')).toBe('shown');
    await pause(ENTER_MS / 3);
    expect(phaseOf('new'), 'entering before the enter duration ends').toBe('entering');
    await vi.waitFor(() => expect(phaseOf('new')).toBe('shown'), { timeout: ENTER_MS * 5, interval: 10 });
  });

  // plan-ui_transitions/REQ-19: a removed item stays as leaving, with its last value, near its position, then goes
  it('keeps a removed item as leaving with its last value near its position, then removes it', async () => {
    render([item('a'), item('b', 'last b'), item('c')]);
    render(of('a', 'c'));
    expect(view()).toEqual(['a:shown', 'b:leaving', 'c:shown']);
    expect(latest[1]?.item.value).toBe('last b');
    await pause(EXIT_MS / 3);
    expect(phaseOf('b'), 'still leaving before the exit duration ends').toBe('leaving');
    await vi.waitFor(() => expect(view()).toEqual(['a:shown', 'c:shown']), { timeout: EXIT_MS * 5, interval: 10 });
  });

  // plan-ui_transitions/REQ-28: a key that comes back while leaving enters again with its new value
  it('turns a key that comes back while leaving into entering, with its new value, and does not remove it later', async () => {
    render(of('a', 'b'));
    render(of('a'));
    expect(phaseOf('b')).toBe('leaving');
    render([item('a'), item('b', 'back')]);
    expect(phaseOf('b')).toBe('entering');
    expect(latest.find((entry) => entry.key === 'b')?.item.value).toBe('back');
    await pause(EXIT_MS * 2);
    expect(phaseOf('b')).toBe('shown');
  });

  // plan-ui_transitions/REQ-20, REQ-21: an item that stays gets its new value; a new order or value starts nothing
  it('gives a staying item its new value and order with no new phase', () => {
    render(of('a', 'b', 'c'));
    render([item('c', 'c2'), item('a', 'a2'), item('b')]);
    expect(view()).toEqual(['c:shown', 'a:shown', 'b:shown']);
    expect(latest[0]?.item.value).toBe('c2');
    expect(latest[1]?.item.value).toBe('a2');
  });

  it('keeps an entering item entering through a refresh of its value', () => {
    render(of('a'));
    render(of('a', 'new'));
    render([item('a'), item('new', 'refreshed')]);
    expect(phaseOf('new')).toBe('entering');
    expect(latest.find((entry) => entry.key === 'new')?.item.value).toBe('refreshed');
  });

  // plan-ui_transitions/REQ-25: duration 0 (reduced motion) → no entering, no leaving
  it('gives no entering and no leaving with 0ms durations', () => {
    setTokens('0ms', '0ms');
    render(of('a', 'b'));
    render(of('a', 'new'));
    expect(view()).toEqual(['a:shown', 'new:shown']);
  });

  // ListPresence "Contract": tokens not set (no style sheet) → no entering, no leaving
  it('gives no entering and no leaving when the tokens are not set', () => {
    setTokens(null, null);
    render(of('a', 'b'));
    render(of('a', 'new'));
    expect(view()).toEqual(['a:shown', 'new:shown']);
  });
});
