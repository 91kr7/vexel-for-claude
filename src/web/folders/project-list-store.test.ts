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
  it('gives one project per group, in the group order, with the folder, the first session lastActivity, available, and no favorite without marks', async () => {
    const { store } = await loaded(groups);
    expect(store.getSnapshot()).toEqual({
      kind: 'ready',
      projects: [
        { folder: '/work/new', lastActivity: '2026-11-10T10:00:00.000Z', available: true, favorite: false },
        { folder: '/work/gone', lastActivity: '2026-11-09T10:00:00.000Z', available: false, favorite: false },
        { folder: '/work/old', lastActivity: '2026-11-08T10:00:00.000Z', available: true, favorite: false },
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

  // pageProjectListStore uses pageProjectMarkLiveStore, which needs the page origin and a WebSocket.
  it('pageProjectListStore gives the same store at each call', () => {
    vi.stubGlobal('window', { location: { origin: 'http://127.0.0.1:4555' } });
    vi.stubGlobal('WebSocket', class {
      addEventListener() {}
      close() {}
    });
    expect(pageProjectListStore()).toBe(pageProjectListStore());
  });
});

/** A mark source as ProjectMarkLiveStore gives it, set by the test. */
function fakeMarks(initial: string[] = []) {
  const listeners = new Set<() => void>();
  let snapshot = { favorites: new Set(initial) as ReadonlySet<string> };
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    set(favorites: string[]) {
      snapshot = { favorites: new Set(favorites) };
      for (const listener of listeners) listener();
    },
  };
}

function markedStore(marks: ReturnType<typeof fakeMarks>) {
  const calls: Deferred[] = [];
  const fetchGroups = vi.fn(() => {
    const call = deferred();
    calls.push(call);
    return call.promise as never;
  });
  return { store: new ProjectListStore(fetchGroups, marks), calls, fetchGroups };
}

const folders = (store: ProjectListStore) => {
  const state = store.getSnapshot();
  return state.kind === 'ready' ? state.projects.map((p) => `${p.folder}${p.favorite ? ' *' : ''}`) : state.kind;
};

const fourGroups = [
  { folder: '/work/a', available: true, sessions: [session('2026-11-10T10:00:00.000Z')] },
  { folder: '/work/b', available: true, sessions: [session('2026-11-09T10:00:00.000Z')] },
  { folder: '/work/c', available: false, sessions: [session('2026-11-08T10:00:00.000Z')] },
  { folder: '/work/d', available: true, sessions: [session('2026-11-07T10:00:00.000Z')] },
];

describe('ProjectListStore with project marks', () => {
  // plan-project_list_actions/REQ-25, REQ-26
  it('puts the favorite projects first; each part keeps the route order', async () => {
    const marks = fakeMarks(['/work/d', '/work/b']);
    const { store, calls } = markedStore(marks);
    store.load();
    calls[0]!.resolve(fourGroups);
    await settle();
    expect(folders(store)).toEqual(['/work/b *', '/work/d *', '/work/a', '/work/c']);
  });

  // plan-project_list_actions/REQ-27: an unavailable project can be favorite
  it('marks an unavailable project as favorite and puts it first', async () => {
    const { store, calls } = markedStore(fakeMarks(['/work/c']));
    store.load();
    calls[0]!.resolve(fourGroups);
    await settle();
    const state = store.getSnapshot();
    expect(state.kind === 'ready' && state.projects[0]).toEqual({ folder: '/work/c', lastActivity: '2026-11-08T10:00:00.000Z', available: false, favorite: true });
  });

  it('ignores marks of folders that are not in the list', async () => {
    const { store, calls } = markedStore(fakeMarks(['/work/elsewhere']));
    store.load();
    calls[0]!.resolve(fourGroups);
    await settle();
    expect(folders(store)).toEqual(['/work/a', '/work/b', '/work/c', '/work/d']);
  });

  // plan-project_list_actions/REQ-29: a mark change shows at once, with no new load
  it('in ready, a mark change gives a new ready state at once, with no new load', async () => {
    const marks = fakeMarks();
    const { store, calls, fetchGroups } = markedStore(marks);
    store.load();
    calls[0]!.resolve(fourGroups);
    await settle();
    const before = store.getSnapshot();
    const listener = vi.fn();
    store.subscribe(listener);

    marks.set(['/work/c']);
    expect(listener).toHaveBeenCalled();
    expect(store.getSnapshot()).not.toBe(before);
    expect(folders(store)).toEqual(['/work/c *', '/work/a', '/work/b', '/work/d']);

    marks.set(['/work/c', '/work/b']);
    expect(folders(store)).toEqual(['/work/b *', '/work/c *', '/work/a', '/work/d']);

    marks.set(['/work/b']);
    expect(folders(store)).toEqual(['/work/b *', '/work/a', '/work/c', '/work/d']);
    expect(fetchGroups).toHaveBeenCalledTimes(1);
  });

  it('applies a mark change to the last loaded list while a new load runs', async () => {
    const marks = fakeMarks();
    const { store, calls } = markedStore(marks);
    store.load();
    calls[0]!.resolve(fourGroups);
    await settle();
    store.load();
    marks.set(['/work/d']);
    expect(folders(store)).toEqual(['/work/d *', '/work/a', '/work/b', '/work/c']);
    calls[1]!.resolve(fourGroups.slice(0, 2));
    await settle();
    expect(folders(store)).toEqual(['/work/a', '/work/b']);
  });

  it.each([
    ['loading', async () => undefined],
    ['error', async (call: Deferred) => {
      call.reject(new Error('down'));
      await settle();
    }],
  ])('in %s, a mark change changes nothing', async (kind, reach) => {
    const marks = fakeMarks();
    const { store, calls } = markedStore(marks);
    store.load();
    await reach(calls[0]!);
    const before = store.getSnapshot();
    expect(before.kind).toBe(kind);
    const listener = vi.fn();
    store.subscribe(listener);
    marks.set(['/work/a']);
    expect(store.getSnapshot()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it('a load that ends after a mark change uses the current marks', async () => {
    const marks = fakeMarks();
    const { store, calls } = markedStore(marks);
    store.load();
    marks.set(['/work/b']);
    calls[0]!.resolve(fourGroups);
    await settle();
    expect(folders(store)).toEqual(['/work/b *', '/work/a', '/work/c', '/work/d']);
  });
});

/** A mark source with favorites and removals, set by the test. */
function fakeRemovalMarks(favorites: string[] = [], removed: Record<string, string> = {}) {
  const listeners = new Set<() => void>();
  const snapshotOf = (f: string[], r: Record<string, string>) => ({ favorites: new Set(f) as ReadonlySet<string>, removed: new Map(Object.entries(r)) as ReadonlyMap<string, string> });
  let snapshot = snapshotOf(favorites, removed);
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    set(nextFavorites: string[], nextRemoved: Record<string, string>) {
      snapshot = snapshotOf(nextFavorites, nextRemoved);
      for (const listener of listeners) listener();
    },
  };
}

async function loadedWith(marks: ReturnType<typeof fakeRemovalMarks>, body: unknown = fourGroups) {
  const calls: Deferred[] = [];
  const fetchGroups = vi.fn(() => {
    const call = deferred();
    calls.push(call);
    return call.promise as never;
  });
  const store = new ProjectListStore(fetchGroups, marks);
  store.load();
  calls[0]!.resolve(body);
  await settle();
  return { store, calls, fetchGroups };
}

// fourGroups: /work/a 2026-11-10T10:00Z, /work/b 2026-11-09T10:00Z, /work/c 2026-11-08T10:00Z (unavailable), /work/d 2026-11-07T10:00Z
describe('ProjectListStore with removed projects', () => {
  // plan-project_list_actions/REQ-13, REQ-15
  it('leaves out a project removed after its last activity', async () => {
    const { store } = await loadedWith(fakeRemovalMarks([], { '/work/b': '2026-11-12T08:00:00.000Z' }));
    expect(folders(store)).toEqual(['/work/a', '/work/c', '/work/d']);
  });

  it('leaves out a project removed at the same time as its last activity, written in another form', async () => {
    const { store } = await loadedWith(fakeRemovalMarks([], { '/work/b': '2026-11-09T10:00:00Z', '/work/d': '2026-11-07T12:00:00+02:00' }));
    expect(folders(store)).toEqual(['/work/a', '/work/c']);
  });

  // plan-project_list_actions/REQ-16: activity after the removal brings the project back
  it('keeps a project whose last activity is later than its removal time', async () => {
    const { store } = await loadedWith(fakeRemovalMarks([], { '/work/b': '2026-11-09T09:59:59.999Z', '/work/a': '2026-11-10T11:30:00+02:00' }));
    expect(folders(store)).toEqual(['/work/a', '/work/b', '/work/c', '/work/d']);
  });

  it.each([
    ['a removal time', { '/work/b': 'not a time' }, fourGroups],
    ['a last activity', { '/work/b': '2026-11-12T08:00:00.000Z' }, fourGroups.map((g) => (g.folder === '/work/b' ? { ...g, sessions: [session('yesterday')] } : g))],
  ])('never hides a project when %s does not parse', async (_name, removed, body) => {
    const { store } = await loadedWith(fakeRemovalMarks([], removed), body);
    expect(folders(store)).toEqual(['/work/a', '/work/b', '/work/c', '/work/d']);
  });

  // plan-project_list_actions/REQ-18
  it('leaves out an unavailable removed project', async () => {
    const { store } = await loadedWith(fakeRemovalMarks([], { '/work/c': '2026-11-12T08:00:00.000Z' }));
    expect(folders(store)).toEqual(['/work/a', '/work/b', '/work/d']);
  });

  it('ignores removals of folders that are not in the list', async () => {
    const { store } = await loadedWith(fakeRemovalMarks([], { '/work/elsewhere': '2026-11-12T08:00:00.000Z' }));
    expect(folders(store)).toEqual(['/work/a', '/work/b', '/work/c', '/work/d']);
  });

  // plan-project_list_actions/REQ-13, REQ-20: a removal leaves the list at once, with no new load
  it('in ready, a removal gives a new ready state at once without the project, with no new load', async () => {
    const marks = fakeRemovalMarks(['/work/c']);
    const { store, fetchGroups } = await loadedWith(marks);
    expect(folders(store)).toEqual(['/work/c *', '/work/a', '/work/b', '/work/d']);
    const before = store.getSnapshot();
    const listener = vi.fn();
    store.subscribe(listener);

    marks.set(['/work/c'], { '/work/a': '2026-11-12T08:00:00.000Z' });
    expect(listener).toHaveBeenCalled();
    expect(store.getSnapshot()).not.toBe(before);
    expect(folders(store)).toEqual(['/work/c *', '/work/b', '/work/d']);

    // The server cleared the removal (a hosted session in the folder): the project is back in its place.
    marks.set(['/work/c'], {});
    expect(folders(store)).toEqual(['/work/c *', '/work/a', '/work/b', '/work/d']);
    expect(fetchGroups).toHaveBeenCalledTimes(1);
  });

  // plan-project_list_actions/REQ-16, REQ-19: a project that comes back by new activity is not favorite
  it('a project removed and back by new activity is placed by last activity, below the favorites', async () => {
    const marks = fakeRemovalMarks(['/work/c'], { '/work/b': '2026-11-09T12:00:00.000Z' });
    const back = [
      { folder: '/work/b', available: true, sessions: [session('2026-11-12T10:00:00.000Z')] },
      ...fourGroups.filter((g) => g.folder !== '/work/b'),
    ];
    const { store } = await loadedWith(marks, back);
    expect(folders(store)).toEqual(['/work/c *', '/work/b', '/work/a', '/work/d']);
  });

  it('a load that ends after a removal uses the current marks', async () => {
    const marks = fakeRemovalMarks();
    const calls: Deferred[] = [];
    const store = new ProjectListStore(() => {
      const call = deferred();
      calls.push(call);
      return call.promise as never;
    }, marks);
    store.load();
    marks.set([], { '/work/d': '2026-11-12T08:00:00.000Z' });
    calls[0]!.resolve(fourGroups);
    await settle();
    expect(folders(store)).toEqual(['/work/a', '/work/b', '/work/c']);
  });
});
