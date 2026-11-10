// @vitest-environment jsdom
// Unit tests of useHistory (plan-git_explorer, batch history).
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

let latest: { history: HistoryState; loadMore: () => void };
const roots: Root[] = [];

function Probe({ root }: { root: string | undefined }) {
  latest = useHistory(root);
  return null;
}

function mount(...args: [] | [string | undefined]) {
  const root = args.length === 0 ? ROOT : args[0];
  const r = createRoot(document.createElement('div'));
  roots.push(r);
  flushSync(() => r.render(<Probe root={root} />));
  return { set: (next: string | undefined) => flushSync(() => r.render(<Probe root={next} />)) };
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
    mount(undefined);
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
    expect(latest.history).toMatchObject({ status: 'loaded', commits: page, hasMore: false, loadingMore: false });
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
    expect(loaded()!.commits).toEqual(commits(1, 150));
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
    expect(loaded()).toMatchObject({ commits: commits(1, 100), hasMore: true, loadingMore: false, moreError: 'fatal: broken' });
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
    probe.set('/other/root');
    await until(() => fetchMock.mock.calls.length === 2);
    expect(requestedUrl(1).searchParams.get('path')).toBe('/other/root');
    pending[1]!(new Response(JSON.stringify({ commits: commits(7, 1), hasMore: false })));
    await until(() => latest.history.status === 'loaded');
    pending[0]!(new Response(JSON.stringify({ commits: commits(1, 2), hasMore: false })));
    await settle();
    expect(loaded()!.commits).toEqual(commits(7, 1));
  });

  // plan-git_explorer/REQ-6
  it('gives the message of an error answer', async () => {
    steps.push({ json: { error: 'git_error', message: 'fatal: bad object HEAD' }, status: 500 });
    mount();
    await until(() => latest.history.status === 'error');
    expect(latest.history).toEqual({ status: 'error', message: 'fatal: bad object HEAD' });
  });

  it.each<[string, Step]>([
    ['an error answer with no message', { json: { error: 'invalid_path' }, status: 400 }],
    ['a failed request', new Error('network down')],
    ['an answer that is not JSON', { text: 'oops' }],
    ['an answer of another shape', { json: { commits: 'none' } }],
  ])('gives the fallback message for %s', async (_name, step) => {
    steps.push(step);
    mount();
    await until(() => latest.history.status === 'error');
    expect(latest.history).toEqual({ status: 'error', message: FALLBACK });
  });
});
