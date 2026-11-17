// @vitest-environment jsdom
// Tests of plan-ui_transitions, batch cascading-lists: the "Motion" entries of the SessionList spec.
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoadStatus, SessionState, SessionSummary } from './live-session-store';
import type { SessionOrder } from './session-order';
import { SessionList } from './SessionList';

const ENTER_MS = 60;
const EXIT_MS = 60;
// Long enough that a test reads the cascade before it ends.
const CASCADE_MAX_MS = 600;

const session = (id: string, state: SessionState = 'idle', extra: Partial<SessionSummary> = {}): SessionSummary => ({
  id,
  folder: `/home/dev/${id}`,
  label: `Label of ${id}`,
  state,
  lastActivity: '2026-11-17T10:00:00.000Z',
  ...extra,
});

interface ListProps {
  sessions: SessionSummary[];
  status?: LoadStatus;
  order?: SessionOrder;
  onOpen?: (id: string) => void;
  onReorder?: (id: string, group: string, index: number) => void;
}

let root: Root | undefined;
let host: HTMLElement;

const render = ({ sessions, status = 'ready', order, onOpen = () => {}, onReorder }: ListProps) =>
  flushSync(() => root?.render(<SessionList sessions={sessions} openSessionId={null} onOpen={onOpen} status={status} order={order} onReorder={onReorder} />));

const itemOf = (id: string) =>
  [...host.querySelectorAll<HTMLLIElement>('li')].find((li) => li.querySelector(`[title="/home/dev/${id}"]`) !== null) ?? null;
const entryOf = (id: string) => itemOf(id)?.querySelector<HTMLButtonElement>('.session-entry') ?? null;
const has = (id: string, name: string) => itemOf(id)?.classList.contains(name) ?? false;
const delayOf = (id: string) => itemOf(id)?.style.getPropertyValue('--cascade-delay') ?? '';
const anyCascade = () => host.querySelector('.cascade-item') !== null;
const shownIds = () => [...host.querySelectorAll('li')].map((li) => li.querySelector('[title^="/home/dev/"]')?.getAttribute('title')?.slice('/home/dev/'.length));
const setTokens = (enter: string, exit: string, cascadeMax: string) => {
  const style = document.documentElement.style;
  style.setProperty('--motion-duration-enter', enter);
  style.setProperty('--motion-duration-exit', exit);
  style.setProperty('--motion-cascade-max', cascadeMax);
};
const waitCascadeEnd = () => vi.waitFor(() => expect(anyCascade()).toBe(false), { timeout: CASCADE_MAX_MS * 3, interval: 10 });

beforeEach(() => {
  setTokens(`${ENTER_MS}ms`, `${EXIT_MS}ms`, `${CASCADE_MAX_MS}ms`);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  root?.unmount();
  root = undefined;
  vi.restoreAllMocks();
  document.body.replaceChildren();
  document.documentElement.removeAttribute('style');
});

const THREE = [session('a'), session('b'), session('c')];
const ORDER: SessionOrder = { running: ['a', 'b', 'c'] };

describe('SessionList cascade', () => {
  // plan-ui_transitions/REQ-16: the first render after loading plays the cascade, in display order
  it('plays the cascade on the first render after loading, with growing delays in display order', () => {
    render({ sessions: [], status: 'loading' });
    expect(anyCascade()).toBe(false);
    render({ sessions: THREE, order: ORDER });
    for (const id of ['a', 'b', 'c']) expect(has(id, 'cascade-item'), id).toBe(true);
    const delays = ['a', 'b', 'c'].map((id) => Number.parseFloat(delayOf(id)));
    expect(delays[0]).toBe(0);
    expect(delays[1]).toBeGreaterThan(delays[0]!);
    expect(delays[2]).toBeGreaterThan(delays[1]!);
  });

  // plan-ui_transitions/REQ-16: each mount, e.g. when the Sessions view shows, plays the cascade
  it('plays the cascade on a mount with the list already loaded', () => {
    render({ sessions: THREE, order: ORDER });
    expect(has('c', 'cascade-item')).toBe(true);
  });

  // plan-ui_transitions/REQ-16: the display order spans the groups
  it('orders the delays by display order across groups', () => {
    render({ sessions: [session('ended', 'ended'), session('idle'), session('asking', 'needs_input')] });
    const delays = ['asking', 'idle', 'ended'].map((id) => Number.parseFloat(delayOf(id)));
    expect(delays).toEqual([...delays].sort((x, y) => x - y));
    expect(new Set(delays).size).toBe(3);
  });

  // plan-ui_transitions/REQ-26: focus and clicks work during the cascade
  it('takes clicks and focus during the cascade', () => {
    const onOpen = vi.fn();
    render({ sessions: THREE, order: ORDER, onOpen });
    expect(has('c', 'cascade-item')).toBe(true);
    entryOf('c')?.focus();
    expect(document.activeElement).toBe(entryOf('c'));
    flushSync(() => entryOf('c')?.click());
    expect(onOpen).toHaveBeenCalledWith('c');
  });

  // plan-ui_transitions/REQ-20: a refresh with the same sessions plays nothing
  it('plays no cascade again when a live refresh brings the same sessions', async () => {
    render({ sessions: THREE, order: ORDER });
    await waitCascadeEnd();
    render({ sessions: THREE.map((s) => ({ ...s, label: `${s.label} again` })), order: ORDER });
    expect(anyCascade()).toBe(false);
    expect(host.querySelector('.is-entering, .is-leaving')).toBeNull();
  });

  // plan-ui_transitions/REQ-20: a loading phase after the appearance does not replay the cascade
  it('plays no cascade again after a new loading phase', async () => {
    render({ sessions: THREE, order: ORDER });
    await waitCascadeEnd();
    render({ sessions: [], status: 'loading' });
    render({ sessions: THREE, order: ORDER });
    expect(anyCascade()).toBe(false);
  });

  // plan-ui_transitions/REQ-21: a group move and a drag reorder play nothing
  it('plays nothing on a group move or a new order', async () => {
    render({ sessions: THREE, order: ORDER });
    await waitCascadeEnd();
    render({ sessions: [session('a', 'ended'), session('b'), session('c')], order: ORDER });
    render({ sessions: [session('a', 'ended'), session('b'), session('c')], order: { running: ['c', 'b'] } });
    expect(shownIds()).toEqual(['c', 'b', 'a']);
    expect(host.querySelector('.cascade-item, .is-entering, .is-leaving')).toBeNull();
  });

  // plan-ui_transitions/REQ-25: reduced motion → no cascade, no slide, no fade
  it('plays nothing with reduced motion, and a removed entry goes at once', () => {
    setTokens('0ms', '0ms', '0ms');
    render({ sessions: THREE, order: ORDER });
    render({ sessions: [session('a'), session('c'), session('d')], order: ORDER });
    expect(host.querySelector('.cascade-item, .is-entering, .is-leaving')).toBeNull();
    expect(itemOf('b')).toBeNull();
  });
});

describe('SessionList new and removed entries', () => {
  // plan-ui_transitions/REQ-18: a new entry, hosted or external, slides in after the appearance
  it.each([
    ['hosted', session('new')],
    ['external', session('new', 'idle', { external: true })],
  ])('slides a new %s entry in, then drops the class', async (_, added) => {
    render({ sessions: THREE, order: ORDER });
    await waitCascadeEnd();
    render({ sessions: [...THREE, added], order: ORDER });
    expect(has('new', 'is-entering')).toBe(true);
    expect(has('new', 'cascade-item')).toBe(false);
    expect(has('a', 'is-entering')).toBe(false);
    await vi.waitFor(() => expect(has('new', 'is-entering')).toBe(false), { timeout: ENTER_MS * 5, interval: 10 });
  });

  // plan-ui_transitions/REQ-19: a removed entry stays in place and fades out, then goes
  it('keeps a removed entry in its place with is-leaving, then removes it', async () => {
    render({ sessions: THREE, order: ORDER });
    render({ sessions: [session('a'), session('c')], order: ORDER });
    expect(shownIds()).toEqual(['a', 'b', 'c']);
    expect(has('b', 'is-leaving')).toBe(true);
    await vi.waitFor(() => expect(itemOf('b')).toBeNull(), { timeout: EXIT_MS * 5, interval: 10 });
    expect(shownIds()).toEqual(['a', 'c']);
  });

  // plan-ui_transitions/REQ-26 and the SessionList "Motion" rule: a leaving entry is inert, hidden and not draggable
  it('makes a leaving entry inert, hidden from assistive technology and not draggable', () => {
    render({ sessions: [session('a'), session('b', 'ended'), session('c')], order: ORDER });
    render({ sessions: [session('a'), session('c')], order: ORDER });
    const leaving = itemOf('b')!;
    expect((leaving as HTMLElement & { inert: boolean }).inert).toBe(true);
    expect(leaving.getAttribute('aria-hidden')).toBe('true');
    expect(leaving.getAttribute('draggable')).not.toBe('true');
    expect(itemOf('a')?.getAttribute('draggable')).toBe('true');
    expect(itemOf('a')?.hasAttribute('aria-hidden')).toBe(false);
  });

  // plan-ui_transitions/REQ-19: the last entry leaving keeps the list, not the "No sessions." state, until it goes
  it('shows the leaving last entry, then "No sessions."', async () => {
    render({ sessions: [session('a')] });
    render({ sessions: [] });
    expect(has('a', 'is-leaving')).toBe(true);
    await vi.waitFor(() => expect(host.textContent).toContain('No sessions.'), { timeout: EXIT_MS * 5, interval: 10 });
  });

  // SessionList "Motion": the other entries keep their keys and focus
  it('keeps the other entries mounted and the focus where it was', async () => {
    render({ sessions: THREE, order: ORDER });
    const kept = entryOf('c')!;
    kept.focus();
    render({ sessions: [session('a'), session('c'), session('new')], order: ORDER });
    expect(entryOf('c')).toBe(kept);
    expect(document.activeElement).toBe(kept);
    await vi.waitFor(() => expect(itemOf('b')).toBeNull(), { timeout: EXIT_MS * 5, interval: 10 });
    expect(entryOf('c')).toBe(kept);
    expect(document.activeElement).toBe(kept);
  });
});

/** Fires a drag event the way the browser does: a mouse event with a data transfer. React commits `dragover` updates on a later task. */
async function fire(target: Element, type: string, clientY = 0) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientY });
  Object.defineProperty(event, 'dataTransfer', { value: { effectAllowed: '', dropEffect: '', setData: () => {}, getData: () => '' } });
  flushSync(() => target.dispatchEvent(event));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// Each entry is 100 px high: clientY 10 is its upper half, 90 its lower half.
const UPPER = 10;
const LOWER = 90;

describe('SessionList drag with a leaving entry', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 100, height: 100, left: 0, right: 100, width: 100, x: 0, y: 0, toJSON: () => ({}) });
  });

  // SessionList "Motion": the slot and index are computed on the staying entries only
  it('sends the index the drop would give with no leaving entry', async () => {
    const onReorder = vi.fn();
    render({ sessions: THREE, order: ORDER, onReorder });
    render({ sessions: [session('a'), session('c')], order: ORDER, onReorder });
    expect(has('b', 'is-leaving')).toBe(true);
    await fire(itemOf('a')!, 'dragstart');
    await fire(itemOf('c')!, 'dragover', LOWER);
    expect(has('c', 'drop-after')).toBe(true);
    await fire(itemOf('c')!, 'drop', LOWER);
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith('a', 'running', 1);
  });

  it('gives the current place for a drop on the half next to the dragged entry, across a leaving entry', async () => {
    const onReorder = vi.fn();
    render({ sessions: THREE, order: ORDER, onReorder });
    render({ sessions: [session('a'), session('c')], order: ORDER, onReorder });
    await fire(itemOf('c')!, 'dragstart');
    await fire(itemOf('a')!, 'dragover', LOWER);
    expect(has('c', 'drop-before')).toBe(true);
    await fire(itemOf('a')!, 'drop', LOWER);
    expect(onReorder).toHaveBeenCalledWith('c', 'running', 1);
  });

  // SessionList "Motion": a leaving entry is no drop target and takes no line
  it('shows no line on a leaving entry and puts drop-after on the last staying entry', async () => {
    render({ sessions: THREE, order: ORDER, onReorder: () => {} });
    render({ sessions: [session('a'), session('b')], order: ORDER, onReorder: () => {} });
    expect(has('c', 'is-leaving')).toBe(true);
    await fire(itemOf('a')!, 'dragstart');
    await fire(itemOf('c')!, 'dragover', UPPER);
    expect(has('c', 'drop-before')).toBe(false);
    expect(has('c', 'drop-after')).toBe(false);
    await fire(itemOf('b')!, 'dragover', LOWER);
    expect(has('b', 'drop-after')).toBe(true);
    expect(has('c', 'drop-before')).toBe(false);
  });

  it('calls no onReorder for a drop on a leaving entry when no line shows', async () => {
    const onReorder = vi.fn();
    render({ sessions: THREE, order: ORDER, onReorder });
    render({ sessions: [session('a'), session('b')], order: ORDER, onReorder });
    await fire(itemOf('a')!, 'dragstart');
    await fire(itemOf('c')!, 'dragover', UPPER);
    await fire(itemOf('c')!, 'drop', UPPER);
    expect(onReorder).not.toHaveBeenCalled();
  });

  // SessionList "Motion": the own group is computed on staying entries: a dragged entry that starts leaving ends the drag
  it('ends the drag when the dragged session is removed', async () => {
    const onReorder = vi.fn();
    render({ sessions: THREE, order: ORDER, onReorder });
    await fire(itemOf('a')!, 'dragstart');
    await fire(itemOf('c')!, 'dragover', LOWER);
    expect(has('c', 'drop-after')).toBe(true);
    render({ sessions: [session('b'), session('c')], order: ORDER, onReorder });
    expect(host.querySelector('.drop-before, .drop-after, .dragging')).toBeNull();
    await fire(itemOf('c')!, 'drop', LOWER);
    expect(onReorder).not.toHaveBeenCalled();
  });
});
