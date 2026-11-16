// @vitest-environment jsdom
// Unit tests of useChanges (plan-git_explorer, batch uncommitted-changes; one state per root: plan-multi_repo_workspace, batch grouped-changes).
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ChangesState, useChanges } from './changes-store';

const FALLBACK = 'Could not read the changes.';
const someChanges = [
  { group: 'staged', kind: 'renamed', path: 'b.txt', oldPath: 'a.txt' },
  { group: 'unstaged', kind: 'untracked', path: 'c.txt' },
];
const otherChanges = [{ group: 'unstaged', kind: 'modified', path: 'z.ts' }];

let latest: ChangesState[];
const mounted: Root[] = [];

function Probe({ roots, revision }: { roots: readonly string[]; revision: number }) {
  latest = useChanges(roots, revision);
  return null;
}

function mount(roots: readonly string[], revision = 0) {
  const r = createRoot(document.createElement('div'));
  mounted.push(r);
  flushSync(() => r.render(<Probe roots={roots} revision={revision} />));
  return { set: (next: readonly string[], nextRevision = revision) => flushSync(() => r.render(<Probe roots={next} revision={nextRevision} />)) };
}

type Request = { path: string; resolve: (response: Response) => void; aborted: () => boolean };
let requests: Request[];
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  requests = [];
  // Like the real fetch: the promise stays pending until answered, and rejects when its signal aborts.
  fetchMock = vi.fn((input: unknown, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    return new Promise<Response>((resolve, reject) => {
      const signal = init?.signal;
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      requests.push({ path: url.searchParams.get('path') ?? '', resolve, aborted: () => signal?.aborted ?? false });
    });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  for (const r of mounted.splice(0)) r.unmount();
  vi.unstubAllGlobals();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
const until = (check: () => boolean) => vi.waitFor(() => expect(check()).toBe(true));
const requestedUrl = (call: number) => new URL(String(fetchMock.mock.calls[call]?.[0]), 'http://localhost');
const requestsOf = (root: string) => requests.filter((r) => r.path === root);
/** Answers the latest request for `root`. */
function answer(root: string, body: unknown, status = 200) {
  requestsOf(root).at(-1)!.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));
}
const loaded = (changes: unknown): ChangesState => ({ status: 'loaded', changes }) as ChangesState;

describe('useChanges', () => {
  it('gives an empty list and asks nothing for no roots', async () => {
    mount([]);
    expect(latest).toEqual([]);
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // plan-git_explorer/REQ-9, plan-multi_repo_workspace/REQ-14
  it('asks GET /api/git/changes once per root and gives one state per root, in the order of the roots', async () => {
    mount(['/ws/api', '/ws/web app']);
    expect(latest).toEqual([{ status: 'loading' }, { status: 'loading' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestedUrl(0).pathname).toBe('/api/git/changes');
    expect(requestedUrl(1).pathname).toBe('/api/git/changes');
    expect(requests.map((r) => r.path).sort()).toEqual(['/ws/api', '/ws/web app']);
    answer('/ws/web app', { changes: otherChanges });
    await until(() => latest[1]!.status === 'loaded');
    expect(latest).toEqual([{ status: 'loading' }, loaded(otherChanges)]);
    answer('/ws/api', { changes: someChanges });
    await until(() => latest[0]!.status === 'loaded');
    expect(latest).toEqual([loaded(someChanges), loaded(otherChanges)]);
  });

  it('asks nothing for the same roots in a new list, and follows their new order', async () => {
    const probe = mount(['/ws/a', '/ws/b']);
    answer('/ws/a', { changes: someChanges });
    answer('/ws/b', { changes: [] });
    await until(() => latest.every((s) => s.status === 'loaded'));
    probe.set(['/ws/a', '/ws/b']);
    probe.set(['/ws/b', '/ws/a']);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(latest).toEqual([loaded([]), loaded(someChanges)]);
  });

  it('is loading in the same render for a root that enters the list, asks only for it, and keeps the others', async () => {
    const probe = mount(['/ws/a']);
    answer('/ws/a', { changes: someChanges });
    await until(() => latest[0]!.status === 'loaded');
    probe.set(['/ws/a', '/ws/b']);
    expect(latest).toEqual([loaded(someChanges), { status: 'loading' }]);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requests[1]!.path).toBe('/ws/b');
    answer('/ws/b', { changes: otherChanges });
    await until(() => latest[1]!.status === 'loaded');
    expect(latest).toEqual([loaded(someChanges), loaded(otherChanges)]);
  });

  it('drops a root that leaves the list, and its late answer', async () => {
    const probe = mount(['/ws/a', '/ws/b']);
    answer('/ws/a', { changes: [] });
    await until(() => latest[0]!.status === 'loaded');
    probe.set(['/ws/a']);
    expect(latest).toEqual([loaded([])]);
    answer('/ws/b', { changes: someChanges });
    await settle();
    expect(latest).toEqual([loaded([])]);
  });

  // plan-git_explorer/REQ-6, plan-multi_repo_workspace/REQ-19
  it('gives the message of an error answer to its root only', async () => {
    mount(['/ws/a', '/ws/b']);
    answer('/ws/b', { error: 'git_error', message: 'fatal: bad object HEAD' }, 500);
    answer('/ws/a', { changes: someChanges });
    await until(() => latest.every((s) => s.status !== 'loading'));
    expect(latest).toEqual([loaded(someChanges), { status: 'error', message: 'fatal: bad object HEAD' }]);
  });

  it.each<[string, (root: string) => void]>([
    ['an error answer with no message', (root) => answer(root, { error: 'invalid_path' }, 400)],
    ['a failed request', (root) => requestsOf(root).at(-1)!.resolve(Promise.reject(new Error('network down')) as never)],
    ['an answer that is not JSON', (root) => answer(root, 'oops')],
    ['an answer with no changes list', (root) => answer(root, { changes: 'none' })],
  ])('gives the fallback message for %s, and the other root keeps its changes', async (_name, fail) => {
    mount(['/ws/a', '/ws/b']);
    answer('/ws/b', { changes: otherChanges });
    fail('/ws/a');
    await until(() => latest.every((s) => s.status !== 'loading'));
    expect(latest).toEqual([{ status: 'error', message: FALLBACK }, loaded(otherChanges)]);
  });

  it('asks no more after the answers', async () => {
    mount(['/ws/a', '/ws/b']);
    answer('/ws/a', { changes: [] });
    answer('/ws/b', { changes: [] });
    await until(() => latest.every((s) => s.status === 'loaded'));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('useChanges refresh', () => {
  // plan-git_explorer/REQ-24
  it('asks every root again on a new revision and keeps each state until its new answer', async () => {
    const probe = mount(['/ws/a', '/ws/b'], 0);
    answer('/ws/a', { changes: someChanges });
    answer('/ws/b', { error: 'git_error', message: 'fatal: x' }, 500);
    await until(() => latest.every((s) => s.status !== 'loading'));
    probe.set(['/ws/a', '/ws/b'], 1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(requestsOf('/ws/a')).toHaveLength(2);
    expect(requestsOf('/ws/b')).toHaveLength(2);
    await settle();
    expect(latest).toEqual([loaded(someChanges), { status: 'error', message: 'fatal: x' }]);
    answer('/ws/b', { changes: otherChanges });
    await until(() => latest[1]!.status === 'loaded');
    expect(latest).toEqual([loaded(someChanges), loaded(otherChanges)]);
    answer('/ws/a', { changes: [] });
    await until(() => latest[0]!.status === 'loaded' && (latest[0] as { changes: unknown[] }).changes.length === 0);
  });

  it('drops the answer of an older revision', async () => {
    const probe = mount(['/ws/a'], 0);
    probe.set(['/ws/a'], 1);
    answer('/ws/a', { changes: someChanges });
    await until(() => latest[0]!.status === 'loaded');
    const older = requestsOf('/ws/a')[0]!;
    older.resolve(new Response(JSON.stringify({ changes: [] })));
    await settle();
    expect(latest).toEqual([loaded(someChanges)]);
  });

  it('does not turn an aborted older request into an error', async () => {
    const probe = mount(['/ws/a'], 0);
    probe.set(['/ws/a'], 1);
    await settle();
    expect(latest).toEqual([{ status: 'loading' }]);
    answer('/ws/a', { changes: otherChanges });
    await until(() => latest[0]!.status === 'loaded');
    await settle();
    expect(latest).toEqual([loaded(otherChanges)]);
  });
});
