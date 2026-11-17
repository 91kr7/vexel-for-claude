// @vitest-environment jsdom
// Tests of plan-ui_transitions, batch cascading-lists: the "Motion" entries of the ProjectList spec.
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectList } from './ProjectList';
import { ProjectListStore } from './project-list-store';

const ENTER_MS = 60;
const CASCADE_MAX_MS = 600;

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const group = (name: string) => ({
  folder: `/home/u/${name}`,
  available: true,
  sessions: [{ id: `id-${name}`, label: 'Label', lastActivity: '2026-11-10T10:00:00.000Z', runningElsewhere: false }],
});
const GROUPS = [group('web-dashboard'), group('old-api'), group('docs')];

/** A store whose loads wait for the test to answer them. */
function controlledStore() {
  const answers: ((body: unknown) => void)[] = [];
  const fetchGroups = vi.fn(() => new Promise((resolve) => answers.push(resolve)));
  return { store: new ProjectListStore(fetchGroups as never), answers };
}

async function loadedStore(body: unknown) {
  const controlled = controlledStore();
  controlled.store.load();
  controlled.answers[0]!(body);
  await settle();
  return controlled;
}

const roots: Root[] = [];
let host: HTMLElement;

function mount(store: ProjectListStore) {
  host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  flushSync(() => root.render(<ProjectList store={store} />));
  return root;
}

const rowOf = (name: string) => [...host.querySelectorAll<HTMLButtonElement>('button.project-row')].find((row) => row.textContent?.includes(`/home/u/${name}`));
const itemOf = (name: string) => rowOf(name)?.closest('li') ?? null;
const cascading = (name: string) => itemOf(name)?.classList.contains('cascade-item') ?? false;
const anyCascade = () => host.querySelector('.cascade-item') !== null;
const searchField = () => host.querySelector<HTMLInputElement>('input[aria-label="Search projects"]')!;
const clearButton = () => host.querySelector<HTMLButtonElement>('button[aria-label="Clear Search"]')!;

function type(text: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  setValue.call(searchField(), text);
  flushSync(() => searchField().dispatchEvent(new Event('input', { bubbles: true })));
}

beforeEach(() => {
  const style = document.documentElement.style;
  style.setProperty('--motion-duration-enter', `${ENTER_MS}ms`);
  style.setProperty('--motion-duration-exit', `${ENTER_MS}ms`);
  style.setProperty('--motion-cascade-max', `${CASCADE_MAX_MS}ms`);
});

afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  document.body.replaceChildren();
  document.documentElement.removeAttribute('style');
});

describe('ProjectList cascade', () => {
  // plan-ui_transitions/REQ-17: the rows of the first shown list enter in sequence
  it('plays the cascade on mount, with growing delays in list order', async () => {
    const { store } = await loadedStore(GROUPS);
    mount(store);
    const names = ['web-dashboard', 'old-api', 'docs'];
    for (const name of names) expect(cascading(name), name).toBe(true);
    const delays = names.map((name) => Number.parseFloat(itemOf(name)!.style.getPropertyValue('--cascade-delay')));
    expect(delays[0]).toBe(0);
    expect(delays[1]).toBeGreaterThan(delays[0]!);
    expect(delays[2]).toBeGreaterThan(delays[1]!);
  });

  // plan-ui_transitions/REQ-17: rows that come after a load still enter in cascade
  it('plays the cascade when the rows first show after the load ends', async () => {
    const { store, answers } = controlledStore();
    store.load();
    mount(store);
    expect(rowOf('docs')).toBeUndefined();
    answers[0]!(GROUPS);
    await settle();
    expect(rowOf('docs')).toBeDefined();
    expect(cascading('docs')).toBe(true);
  });

  // plan-ui_transitions/REQ-17: each time the Projects view shows, the cascade plays again
  it('plays the cascade again on a new mount', async () => {
    const { store } = await loadedStore(GROUPS);
    const first = mount(store);
    await vi.waitFor(() => expect(anyCascade()).toBe(false), { timeout: CASCADE_MAX_MS * 3, interval: 10 });
    first.unmount();
    roots.splice(roots.indexOf(first), 1);
    mount(store);
    expect(cascading('docs')).toBe(true);
  });

  // plan-ui_transitions/REQ-26: the rows take focus during the cascade
  it('lets a row take the focus during the cascade', async () => {
    const { store } = await loadedStore(GROUPS);
    mount(store);
    rowOf('docs')!.focus();
    expect(document.activeElement).toBe(rowOf('docs'));
    expect(cascading('docs')).toBe(true);
  });

  // plan-ui_transitions/REQ-21: typing filters at once, and a cascade still playing ends
  it('ends the cascade at once when the user types in the search', async () => {
    const { store } = await loadedStore(GROUPS);
    mount(store);
    expect(anyCascade()).toBe(true);
    type('api');
    expect(rowOf('web-dashboard')).toBeUndefined();
    expect(rowOf('old-api')).toBeDefined();
    expect(anyCascade()).toBe(false);
  });

  // plan-ui_transitions/REQ-21: "Clear Search" shows every row at once, with no cascade
  it('plays no cascade when "Clear Search" brings the rows back', async () => {
    const { store } = await loadedStore(GROUPS);
    mount(store);
    type('docs');
    flushSync(() => clearButton().click());
    expect(rowOf('web-dashboard')).toBeDefined();
    expect(anyCascade()).toBe(false);
  });

  // plan-ui_transitions/REQ-20: a new list from the store plays nothing
  it('plays no cascade when the store gives a new list', async () => {
    const { store, answers } = await loadedStore(GROUPS);
    mount(store);
    await vi.waitFor(() => expect(anyCascade()).toBe(false), { timeout: CASCADE_MAX_MS * 3, interval: 10 });
    store.load();
    answers[1]!([...GROUPS, group('fresh')]);
    await settle();
    expect(rowOf('fresh')).toBeDefined();
    expect(anyCascade()).toBe(false);
  });

  // plan-ui_transitions/REQ-25: reduced motion → no cascade
  it('plays nothing with reduced motion', async () => {
    const style = document.documentElement.style;
    style.setProperty('--motion-duration-enter', '0ms');
    style.setProperty('--motion-cascade-max', '0ms');
    const { store } = await loadedStore(GROUPS);
    mount(store);
    expect(anyCascade()).toBe(false);
  });
});
