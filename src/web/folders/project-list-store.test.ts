import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectListStore, pageProjectListStore } from './project-list-store';

interface Deferred {
  promise: Promise<unknown>;
  resolve: (body: unknown) => void;
  reject: (error: unknown) => void;
}

function deferred(): Deferred {
  let resolve!: (body: unknown) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<unknown>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A store whose loads wait for the test to answer them, in the order they started. */
function controlledStore() {
  const calls: Deferred[] = [];
  const store = new ProjectListStore(() => {
    const call = deferred();
    calls.push(call);
    return call.promise as never;
  });
  return { store, calls };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const session = (lastActivity: string) => ({ id: `id-${lastActivity}`, label: 'Label', lastActivity, runningElsewhere: false });

const groups = [
  { folder: '/work/new', available: true, sessions: [session('2026-11-10T10:00:00.000Z'), session('2026-11-01T10:00:00.000Z')] },
  { folder: '/work/gone', available: false, sessions: [session('2026-11-09T10:00:00.000Z')] },
  { folder: '/work/old', available: true, sessions: [session('2026-11-08T10:00:00.000Z')] },
];

async function loaded(body: unknown) {
  const { store, calls } = controlledStore();
  store.load();
  calls[0]!.resolve(body);
  await settle();
  return { store, calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProjectListStore', () => {
  // ProjectListStore rules: initial state loading, no load before load()
  it('starts in loading and reads nothing until load()', async () => {
    const fetchGroups = vi.fn(async () => groups);
    const store = new ProjectListStore(fetchGroups as never);
    await settle();
    expect(store.getSnapshot()).toEqual({ kind: 'loading' });
    expect(fetchGroups).not.toHaveBeenCalled();
    store.load();
    expect(fetchGroups).toHaveBeenCalledTimes(1);
  });

  // plan-recent_projects/REQ-3, REQ-6, REQ-7, REQ-10: one project per group, in the route order
  it('gives one project per group, in the group order, with the folder, the first session lastActivity and available', async () => {
    const { store } = await loaded(groups);
    expect(store.getSnapshot()).toEqual({
      kind: 'ready',
      projects: [
        { folder: '/work/new', lastActivity: '2026-11-10T10:00:00.000Z', available: true },
        { folder: '/work/gone', lastActivity: '2026-11-09T10:00:00.000Z', available: false },
        { folder: '/work/old', lastActivity: '2026-11-08T10:00:00.000Z', available: true },
      ],
    });
  });

  it('marks a project available when its group has no boolean available', async () => {
    const { store } = await loaded([
      { folder: '/work/a', sessions: [session('2026-11-10T10:00:00.000Z')] },
      { folder: '/work/b', available: 'no', sessions: [session('2026-11-09T10:00:00.000Z')] },
    ]);
    const state = store.getSnapshot();
    expect(state.kind === 'ready' && state.projects.map((p) => p.available)).toEqual([true, true]);
  });

  it('leaves out a group with no session', async () => {
    const { store } = await loaded([{ folder: '/work/empty', available: true, sessions: [] }, groups[2]]);
    const state = store.getSnapshot();
    expect(state.kind === 'ready' && state.projects.map((p) => p.folder)).toEqual(['/work/old']);
  });

  // plan-recent_projects/REQ-9: no group gives an empty ready list
  it('is ready with no project when the route gives no group', async () => {
    const { store } = await loaded([]);
    expect(store.getSnapshot()).toEqual({ kind: 'ready', projects: [] });
  });

  it.each([
    ['a rejected load', (call: Deferred) => call.reject(new Error('down'))],
    ['a body that is not an array', (call: Deferred) => call.resolve({ groups: [] })],
  ])('goes to error on %s when no list was ever loaded', async (_name, fail) => {
    const { store, calls } = controlledStore();
    store.load();
    fail(calls[0]!);
    await settle();
    expect(store.getSnapshot()).toEqual({ kind: 'error' });
  });

  // plan-recent_projects/REQ-12: the last list stays while a new load runs, and after a failed one
  it('keeps the same ready state while a new load runs and when it fails', async () => {
    const { store, calls } = await loaded(groups);
    const ready = store.getSnapshot();
    store.load();
    expect(store.getSnapshot()).toBe(ready);
    calls[1]!.reject(new Error('down'));
    await settle();
    expect(store.getSnapshot()).toBe(ready);
    store.load();
    calls[2]!.resolve('not an array');
    await settle();
    expect(store.getSnapshot()).toBe(ready);
  });

  // plan-recent_projects/REQ-8: each load shows the current content
  it('replaces the list with the result of a new load', async () => {
    const { store, calls } = await loaded(groups);
    store.load();
    calls[1]!.resolve([groups[2]]);
    await settle();
    const state = store.getSnapshot();
    expect(state.kind === 'ready' && state.projects.map((p) => p.folder)).toEqual(['/work/old']);
  });

  it('goes from error to loading when a new load starts, then to ready', async () => {
    const { store, calls } = controlledStore();
    store.load();
    calls[0]!.reject(new Error('down'));
    await settle();
    store.load();
    expect(store.getSnapshot()).toEqual({ kind: 'loading' });
    calls[1]!.resolve(groups);
    await settle();
    expect(store.getSnapshot().kind).toBe('ready');
  });

  it('applies only the result of the last started load', async () => {
    const { store, calls } = controlledStore();
    store.load();
    store.load();
    calls[1]!.resolve([groups[2]]);
    await settle();
    calls[0]!.resolve(groups);
    await settle();
    const state = store.getSnapshot();
    expect(state.kind === 'ready' && state.projects.map((p) => p.folder)).toEqual(['/work/old']);
  });

  it('ignores the failure of an older load once a later one succeeded', async () => {
    const { store, calls } = controlledStore();
    store.load();
    store.load();
    calls[1]!.resolve(groups);
    await settle();
    const ready = store.getSnapshot();
    calls[0]!.reject(new Error('late'));
    await settle();
    expect(store.getSnapshot()).toBe(ready);
  });

  it('calls a listener on each change of state until it unsubscribes', async () => {
    const { store, calls } = controlledStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.load();
    calls[0]!.resolve(groups);
    await settle();
    expect(listener).toHaveBeenCalled();
    const count = listener.mock.calls.length;
    unsubscribe();
    store.load();
    calls[1]!.resolve([]);
    await settle();
    expect(listener).toHaveBeenCalledTimes(count);
  });

  it('gives the same snapshot object while the state does not change', async () => {
    const { store } = await loaded(groups);
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  describe('default fetchGroups', () => {
    it('loads GET /api/past-sessions', async () => {
      const fetch = vi.fn(async () => new Response(JSON.stringify(groups), { status: 200, headers: { 'content-type': 'application/json' } }));
      vi.stubGlobal('fetch', fetch);
      const store = new ProjectListStore();
      store.load();
      await vi.waitFor(() => expect(store.getSnapshot().kind).toBe('ready'));
      const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit | undefined];
      expect(String(url)).toMatch(/\/api\/past-sessions$/);
      expect(init?.method ?? 'GET').toBe('GET');
    });

    it('treats a non-2xx answer as a failure', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(groups), { status: 500 })));
      const store = new ProjectListStore();
      store.load();
      await vi.waitFor(() => expect(store.getSnapshot()).toEqual({ kind: 'error' }));
    });
  });

  it('pageProjectListStore gives the same store at each call', () => {
    expect(pageProjectListStore()).toBe(pageProjectListStore());
  });
});
