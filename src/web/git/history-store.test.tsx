// @vitest-environment jsdom
// Unit tests of useHistory (plan-git_explorer batch history, plan-multi_repo_workspace batch combined-history).
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type Commit, type HistoryState, useHistory } from './history-store';

const FALLBACK = 'Could not read the history.';
const ROOT = '/home/dev/project';

const commit = (n: number): Commit => ({
  hash: n.toString(16).padStart(40, '0'),
  shortHash: n.toString(16).padStart(7, '0'),
  message: `commit ${n}`,
  author: 'Ada',
  date: '2026-11-10T15:25:02+01:00',
});
const commits = (from: number, count: number) => Array.from({ length: count }, (_, i) => commit(from + i));
const of = (root: string, list: Commit[]) => list.map((c) => ({ root, commit: c }));

let latest: { history: HistoryState; loadMore: () => void };
const roots: Root[] = [];

function Probe({ list }: { list: readonly string[] }) {
  latest = useHistory(list);
  return null;
}

function mount(list: readonly string[] = [ROOT]) {
  const r = createRoot(document.createElement('div'));
  roots.push(r);
  flushSync(() => r.render(<Probe list={list} />));
  return { set: (next: readonly string[]) => flushSync(() => r.render(<Probe list={next} />)) };
}

type Step = { json: unknown; status?: number } | { text: string; status?: number } | Error | 'pending';
let steps: Step[];
let fetchMock: ReturnType<typeof vi.fn>;
const pending: Array<(response: Response) => void> = [];

beforeEach(() => {
  steps = [];
  pending.length = 0;
  fetchMock = vi.fn(() => {
    const step = steps.shift() ?? { json: { commits: [], hasMore: false } };
    if (step === 'pending') return new Promise<Response>((resolve) => pending.push(resolve));
    if (step instanceof Error) return Promise.reject(step);
    const body = 'json' in step ? JSON.stringify(step.json) : step.text;
    return Promise.resolve(new Response(body, { status: step.status ?? 200 }));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  vi.unstubAllGlobals();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
const until = (check: () => boolean) => vi.waitFor(() => expect(check()).toBe(true));
const requestedUrl = (call: number) => new URL(String(fetchMock.mock.calls[call]?.[0]), 'http://localhost');
const loaded = () => latest.history.status === 'loaded' ? latest.history : undefined;

describe('useHistory', () => {
  it('is idle and asks nothing with no root', async () => {
    mount([]);
    expect(latest.history).toEqual({ status: 'idle' });
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // plan-git_explorer/REQ-16
  it('asks the first page of the root at offset 0 and gives its commits', async () => {
    steps.push('pending');
    mount();
    await settle();
    expect(latest.history).toEqual({ status: 'loading' });
    const page = commits(1, 3);
    pending[0]!(new Response(JSON.stringify({ commits: page, hasMore: false })));
    await until(() => latest.history.status === 'loaded');
    expect(latest.history).toMatchObject({ status: 'loaded', commits: of(ROOT, page), hasMore: false, loadingMore: false, errors: [] });
    expect(loaded()!.moreError).toBeUndefined();
    const url = requestedUrl(0);
    expect(url.pathname).toBe('/api/git/history');
    expect(url.searchParams.get('path')).toBe(ROOT);
    expect(url.searchParams.get('offset')).toBe('0');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // plan-git_explorer/REQ-21
  it('loads the next page at the offset of the commits loaded, and appends it', async () => {
    steps.push({ json: { commits: commits(1, 100), hasMore: true } }, 'pending');
    mount();
    await until(() => latest.history.status === 'loaded');
    flushSync(() => latest.loadMore());
    await until(() => loaded()?.loadingMore === true);
    expect(requestedUrl(1).searchParams.get('offset')).toBe('100');
    expect(requestedUrl(1).searchParams.get('path')).toBe(ROOT);
    flushSync(() => latest.loadMore());
    await settle();
    expect(fetchMock, 'a second call while in flight does nothing').toHaveBeenCalledTimes(2);
    pending[0]!(new Response(JSON.stringify({ commits: commits(101, 50), hasMore: false })));
    await until(() => loaded()?.loadingMore === false);
    expect(loaded()!.commits).toEqual(of(ROOT, commits(1, 150)));
    expect(loaded()!.hasMore).toBe(false);
  });

  it('does nothing on loadMore when there is no more', async () => {
    steps.push({ json: { commits: commits(1, 2), hasMore: false } });
    mount();
    await until(() => latest.history.status === 'loaded');
    flushSync(() => latest.loadMore());
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does nothing on loadMore while the first page loads', async () => {
    steps.push('pending');
    mount();
    flushSync(() => latest.loadMore());
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the commits, gives moreError and keeps hasMore when the next page fails, so the user can retry', async () => {
    steps.push({ json: { commits: commits(1, 100), hasMore: true } }, { json: { error: 'git_error', message: 'fatal: broken' }, status: 500 });
    mount();
    await until(() => latest.history.status === 'loaded');
    flushSync(() => latest.loadMore());
    await until(() => loaded()?.moreError !== undefined);
    expect(loaded()).toMatchObject({ commits: of(ROOT, commits(1, 100)), hasMore: true, loadingMore: false, moreError: 'fatal: broken' });
    steps.push({ json: { commits: commits(101, 1), hasMore: false } });
    flushSync(() => latest.loadMore());
    await until(() => loaded()?.commits.length === 101);
    expect(requestedUrl(2).searchParams.get('offset')).toBe('100');
  });

  it('gives the fallback moreError for a failed next request', async () => {
    steps.push({ json: { commits: commits(1, 100), hasMore: true } }, new Error('network down'));
    mount();
    await until(() => latest.history.status === 'loaded');
    flushSync(() => latest.loadMore());
    await until(() => loaded()?.moreError !== undefined);
    expect(loaded()!.moreError).toBe(FALLBACK);
  });

  it('asks again when the root changes and drops the answer for the previous root', async () => {
    steps.push('pending', 'pending');
    const probe = mount();
    probe.set(['/other/root']);
    await until(() => fetchMock.mock.calls.length === 2);
    expect(requestedUrl(1).searchParams.get('path')).toBe('/other/root');
    pending[1]!(new Response(JSON.stringify({ commits: commits(7, 1), hasMore: false })));
    await until(() => latest.history.status === 'loaded');
    pending[0]!(new Response(JSON.stringify({ commits: commits(1, 2), hasMore: false })));
    await settle();
    expect(loaded()!.commits).toEqual(of('/other/root', commits(7, 1)));
  });

  // plan-git_explorer/REQ-6, plan-multi_repo_workspace/REQ-26
  it('gives the message of an error answer as the error of its root, with no commits', async () => {
    steps.push({ json: { error: 'git_error', message: 'fatal: bad object HEAD' }, status: 500 });
    mount();
    await until(() => latest.history.status === 'loaded');
    expect(latest.history).toMatchObject({ status: 'loaded', commits: [], hasMore: false, errors: [{ root: ROOT, message: 'fatal: bad object HEAD' }] });
  });

  it.each<[string, Step]>([
    ['an error answer with no message', { json: { error: 'invalid_path' }, status: 400 }],
    ['a failed request', new Error('network down')],
    ['an answer that is not JSON', { text: 'oops' }],
    ['an answer of another shape', { json: { commits: 'none' } }],
  ])('gives the fallback message for %s', async (_name, step) => {
    steps.push(step);
    mount();
    await until(() => latest.history.status === 'loaded');
    expect(loaded()!.errors).toEqual([{ root: ROOT, message: FALLBACK }]);
    expect(loaded()!.commits).toEqual([]);
  });
});

function RevisionProbe({ list, revision }: { list: readonly string[]; revision: number }) {
  latest = useHistory(list, revision);
  return null;
}

function mountRevision(list: readonly string[], revision = 0) {
  const r = createRoot(document.createElement('div'));
  roots.push(r);
  flushSync(() => r.render(<RevisionProbe list={list} revision={revision} />));
  return { set: (next: readonly string[], nextRevision: number) => flushSync(() => r.render(<RevisionProbe list={next} revision={nextRevision} />)) };
}

describe('useHistory refresh', () => {
  // plan-git_explorer/REQ-24
  it('reads the first page again on a new revision, keeping the commits with loadingMore until it answers', async () => {
    steps.push({ json: { commits: commits(1, 100), hasMore: true } }, 'pending');
    const probe = mountRevision([ROOT]);
    await until(() => latest.history.status === 'loaded');
    probe.set([ROOT], 1);
    await until(() => fetchMock.mock.calls.length === 2);
    expect(requestedUrl(1).searchParams.get('path')).toBe(ROOT);
    expect(requestedUrl(1).searchParams.get('offset')).toBe('0');
    await until(() => loaded()?.loadingMore === true);
    expect(loaded()!.commits).toEqual(of(ROOT, commits(1, 100)));
    expect(loaded()!.moreError).toBeUndefined();
    pending[0]!(new Response(JSON.stringify({ commits: commits(50, 3), hasMore: false })));
    await until(() => loaded()?.loadingMore === false);
    expect(latest.history).toMatchObject({ status: 'loaded', commits: of(ROOT, commits(50, 3)), hasMore: false, loadingMore: false });
  });

  it('keeps only the first page after a refresh: pages read before are dropped', async () => {
    steps.push({ json: { commits: commits(1, 100), hasMore: true } }, { json: { commits: commits(101, 20), hasMore: false } });
    const probe = mountRevision([ROOT]);
    await until(() => latest.history.status === 'loaded');
    flushSync(() => latest.loadMore());
    await until(() => loaded()?.commits.length === 120);
    steps.push({ json: { commits: commits(1, 100), hasMore: true } });
    probe.set([ROOT], 1);
    await until(() => loaded()?.commits.length === 100 && loaded()?.loadingMore === false);
    expect(loaded()!.hasMore).toBe(true);
  });

  it('clears a moreError while the refresh is in flight', async () => {
    steps.push({ json: { commits: commits(1, 100), hasMore: true } }, new Error('network down'), 'pending');
    const probe = mountRevision([ROOT]);
    await until(() => latest.history.status === 'loaded');
    flushSync(() => latest.loadMore());
    await until(() => loaded()?.moreError !== undefined);
    probe.set([ROOT], 1);
    await until(() => loaded()?.loadingMore === true);
    expect(loaded()!.moreError).toBeUndefined();
  });

  it('drops a load-more page still in flight when a refresh starts', async () => {
    steps.push({ json: { commits: commits(1, 100), hasMore: true } }, 'pending', 'pending');
    const probe = mountRevision([ROOT]);
    await until(() => latest.history.status === 'loaded');
    flushSync(() => latest.loadMore());
    await until(() => fetchMock.mock.calls.length === 2);
    probe.set([ROOT], 1);
    await until(() => fetchMock.mock.calls.length === 3);
    pending[1]!(new Response(JSON.stringify({ commits: commits(1, 5), hasMore: false })));
    await until(() => loaded()?.loadingMore === false);
    pending[0]!(new Response(JSON.stringify({ commits: commits(101, 10), hasMore: false })));
    await settle();
    expect(loaded()!.commits).toEqual(of(ROOT, commits(1, 5)));
  });

  it('drops the answer of an older revision', async () => {
    steps.push('pending', 'pending');
    const probe = mountRevision([ROOT]);
    probe.set([ROOT], 1);
    await until(() => fetchMock.mock.calls.length === 2);
    pending[1]!(new Response(JSON.stringify({ commits: commits(9, 1), hasMore: false })));
    await until(() => latest.history.status === 'loaded');
    pending[0]!(new Response(JSON.stringify({ commits: commits(1, 4), hasMore: false })));
    await settle();
    expect(loaded()!.commits).toEqual(of(ROOT, commits(9, 1)));
  });

  it('keeps the errors of the failed roots until the refresh answers', async () => {
    steps.push({ json: { error: 'git_error', message: 'fatal: broken' }, status: 500 }, 'pending');
    const probe = mountRevision([ROOT]);
    await until(() => latest.history.status === 'loaded');
    probe.set([ROOT], 1);
    await settle();
    expect(loaded()!.errors).toEqual([{ root: ROOT, message: 'fatal: broken' }]);
    pending[0]!(new Response(JSON.stringify({ commits: commits(1, 1), hasMore: false })));
    await until(() => loaded()?.errors.length === 0);
    expect(loaded()!.commits).toEqual(of(ROOT, commits(1, 1)));
  });

  it('asks nothing on a new revision with no roots', async () => {
    const probe = mountRevision([]);
    probe.set([], 1);
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(latest.history).toEqual({ status: 'idle' });
  });

  it('is loading in the same render when the root changes', async () => {
    steps.push({ json: { commits: commits(1, 2), hasMore: false } }, 'pending');
    const probe = mountRevision([ROOT]);
    await until(() => latest.history.status === 'loaded');
    probe.set(['/other/root'], 0);
    expect(latest.history).toEqual({ status: 'loading' });
  });
});

const API = '/ws/api';
const APP = '/ws/web/app';

/** Commit `n` of a repository, committed on `day` of November 2026. */
const dated = (n: number, day: number): Commit => ({ ...commit(n), committerDate: `2026-11-${String(day).padStart(2, '0')}T12:00:00Z` });
/** `count` commits from `n` on, one day older each, starting on `day`. */
const run = (n: number, count: number, day: number) => Array.from({ length: count }, (_, i) => dated(n + i, day - i));
const page = (list: Commit[], hasMore = false) => new Response(JSON.stringify({ commits: list, hasMore }));
const failure = (message: string) => new Response(JSON.stringify({ error: 'git_error', message }), { status: 500 });

describe('useHistory on several roots', () => {
  // Pending requests per root path, answered by the test in any order.
  let waiting: Map<string, Array<{ offset: string; answer: (response: Response) => void }>>;

  beforeEach(() => {
    waiting = new Map();
    fetchMock = vi.fn((input: string) => {
      const url = new URL(String(input), 'http://localhost');
      const root = url.searchParams.get('path')!;
      return new Promise<Response>((resolve) => {
        const list = waiting.get(root) ?? [];
        list.push({ offset: url.searchParams.get('offset')!, answer: resolve });
        waiting.set(root, list);
      });
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  const answer = (root: string, response: Response) => {
    const next = waiting.get(root)?.shift();
    if (next === undefined) throw new Error(`no request in flight for ${root}`);
    next.answer(response);
    return next.offset;
  };
  const asked = (root: string) => waiting.get(root)?.length ?? 0;

  // plan-multi_repo_workspace/REQ-21
  it('asks the first page of each root and gives one list newest first, each commit with its root', async () => {
    mount([API, APP]);
    await until(() => asked(API) === 1 && asked(APP) === 1);
    expect(answer(API, page([dated(1, 9), dated(2, 5), dated(3, 1)]))).toBe('0');
    await settle();
    expect(latest.history, 'one root never shows before the others').toEqual({ status: 'loading' });
    expect(answer(APP, page([dated(11, 8), dated(12, 2)]))).toBe('0');
    await until(() => latest.history.status === 'loaded');
    expect(loaded()!.commits).toEqual([
      { root: API, commit: dated(1, 9) },
      { root: APP, commit: dated(11, 8) },
      { root: API, commit: dated(2, 5) },
      { root: APP, commit: dated(12, 2) },
      { root: API, commit: dated(3, 1) },
    ]);
    expect(loaded()).toMatchObject({ hasMore: false, loadingMore: false, errors: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // plan-multi_repo_workspace/REQ-26
  it('gives the error of a failed root apart and still the commits of the others', async () => {
    mount([APP, API]);
    await until(() => asked(API) === 1 && asked(APP) === 1);
    answer(API, page([dated(1, 9)]));
    answer(APP, failure('fatal: not a git repository'));
    await until(() => latest.history.status === 'loaded');
    expect(loaded()!.commits).toEqual([{ root: API, commit: dated(1, 9) }]);
    expect(loaded()!.errors).toEqual([{ root: APP, message: 'fatal: not a git repository' }]);
  });

  it('gives the errors in the order of the roots', async () => {
    mount([APP, API]);
    await until(() => asked(API) === 1 && asked(APP) === 1);
    answer(API, failure('api broken'));
    answer(APP, failure('app broken'));
    await until(() => latest.history.status === 'loaded');
    expect(loaded()).toMatchObject({ commits: [], hasMore: false });
    expect(loaded()!.errors).toEqual([
      { root: APP, message: 'app broken' },
      { root: API, message: 'api broken' },
    ]);
  });

  it('asks nothing again for the same roots in a new list, and asks again for another order', async () => {
    const probe = mount([API, APP]);
    await until(() => fetchMock.mock.calls.length === 2);
    probe.set([API, APP]);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    probe.set([APP, API]);
    await until(() => fetchMock.mock.calls.length === 4);
  });

  // plan-multi_repo_workspace/REQ-21, REQ-24
  it('reads the next page only of the border roots, at the count of their loaded commits, and appends it', async () => {
    mount([API, APP]);
    await until(() => asked(API) === 1 && asked(APP) === 1);
    // API has more and runs out first: it is the border. APP has no more.
    answer(API, page(run(1, 3, 20), true));
    answer(APP, page(run(11, 3, 25)));
    await until(() => latest.history.status === 'loaded');
    expect(loaded()!.hasMore).toBe(true);
    expect(loaded()!.commits.map(({ root }) => root)).toEqual([APP, APP, APP, API, API, API]);
    flushSync(() => latest.loadMore());
    await until(() => loaded()?.loadingMore === true);
    expect(asked(APP), 'a root with no more pages is not read again').toBe(0);
    expect(asked(API)).toBe(1);
    expect(answer(API, page(run(4, 2, 17)))).toBe('3');
    await until(() => loaded()?.loadingMore === false);
    expect(loaded()!.commits.filter(({ root }) => root === API).map(({ commit: c }) => c)).toEqual(run(1, 5, 20));
    expect(loaded()!.hasMore).toBe(false);
  });

  it('keeps loaded commits past the border hidden until the border root reads more', async () => {
    mount([API, APP]);
    await until(() => asked(API) === 1 && asked(APP) === 1);
    // API (more pages) ends on day 10; APP has commits loaded down to day 1.
    answer(API, page(run(1, 2, 11), true));
    answer(APP, page(run(11, 4, 12)));
    await until(() => latest.history.status === 'loaded');
    const shown = loaded()!.commits.map(({ commit: c }) => c.hash);
    expect(shown).toEqual([dated(11, 12), dated(1, 11), dated(12, 11), dated(2, 10)].map((c) => c.hash));
    flushSync(() => latest.loadMore());
    await until(() => asked(API) === 1);
    expect(asked(APP)).toBe(0);
    answer(API, page([dated(3, 5)]));
    await until(() => loaded()?.commits.length === 7);
    expect(loaded()!.commits.map(({ commit: c }) => c.hash).slice(4)).toEqual([dated(13, 10), dated(14, 9), dated(3, 5)].map((c) => c.hash));
  });

  it('reads the next page of every border root and changes the state once all answer; a failed page keeps that root and gives moreError', async () => {
    mount([API, APP]);
    await until(() => asked(API) === 1 && asked(APP) === 1);
    answer(API, page([], true));
    answer(APP, page([], true));
    await until(() => latest.history.status === 'loaded');
    expect(loaded()).toMatchObject({ commits: [], hasMore: true });
    flushSync(() => latest.loadMore());
    await until(() => asked(API) === 1 && asked(APP) === 1);
    answer(APP, page([dated(11, 9)]));
    await settle();
    expect(loaded()).toMatchObject({ commits: [], loadingMore: true });
    answer(API, failure('fatal: pack broken'));
    await until(() => loaded()?.loadingMore === false);
    expect(loaded()!.moreError).toBe('fatal: pack broken');
    expect(loaded()!.hasMore, 'the failed root keeps its hasMore').toBe(true);
    flushSync(() => latest.loadMore());
    await until(() => asked(API) === 1);
    expect(asked(APP)).toBe(0);
    expect(answer(API, page([dated(1, 3)]))).toBe('0');
    await until(() => loaded()?.commits.length === 2);
    expect(loaded()!.commits).toEqual([
      { root: APP, commit: dated(11, 9) },
      { root: API, commit: dated(1, 3) },
    ]);
    expect(loaded()!.moreError).toBeUndefined();
  });

  it('gives the first moreError in the order of the roots', async () => {
    mount([APP, API]);
    await until(() => asked(API) === 1 && asked(APP) === 1);
    answer(API, page([], true));
    answer(APP, page([], true));
    await until(() => latest.history.status === 'loaded');
    flushSync(() => latest.loadMore());
    await until(() => asked(API) === 1 && asked(APP) === 1);
    answer(API, failure('api broken'));
    answer(APP, failure('app broken'));
    await until(() => loaded()?.moreError !== undefined);
    expect(loaded()!.moreError).toBe('app broken');
  });

  // plan-multi_repo_workspace/REQ-21
  it('on a refresh keeps the commits until every first page answers, then shows only the first pages', async () => {
    const probe = mountRevision([API, APP]);
    await until(() => asked(API) === 1 && asked(APP) === 1);
    answer(API, page(run(1, 2, 10)));
    answer(APP, page(run(11, 1, 20)));
    await until(() => latest.history.status === 'loaded');
    const before = loaded()!.commits;
    probe.set([API, APP], 1);
    await until(() => asked(API) === 1 && asked(APP) === 1);
    await until(() => loaded()?.loadingMore === true);
    expect(answer(API, page([dated(5, 1)]))).toBe('0');
    await settle();
    expect(loaded()!.commits).toEqual(before);
    expect(answer(APP, failure('fatal: gone'))).toBe('0');
    await until(() => loaded()?.loadingMore === false);
    expect(loaded()!.commits).toEqual([{ root: API, commit: dated(5, 1) }]);
    expect(loaded()!.errors).toEqual([{ root: APP, message: 'fatal: gone' }]);
  });
});
