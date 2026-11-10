// @vitest-environment jsdom
// Unit tests of useFileDiff (plan-git_explorer, batch uncommitted-changes).
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChangeEntry } from './changes-store';
import { type FileDiffState, useFileDiff } from './diff-store';

const FALLBACK = 'Could not read the diff.';
const ROOT = '/home/dev/project';
const someDiff = { binary: false, cut: false, lines: [{ kind: 'added', text: 'x' }] };
const modified: ChangeEntry = { group: 'unstaged', kind: 'modified', path: 'src/a b.ts' };
const renamed: ChangeEntry = { group: 'staged', kind: 'renamed', path: 'new.ts', oldPath: 'old.ts' };

let latest: FileDiffState;
const roots: Root[] = [];

function Probe({ root, entry }: { root: string; entry: ChangeEntry | undefined }) {
  latest = useFileDiff(root, entry);
  return null;
}

function mount(entry: ChangeEntry | undefined, root = ROOT) {
  const r = createRoot(document.createElement('div'));
  roots.push(r);
  flushSync(() => r.render(<Probe root={root} entry={entry} />));
  return { set: (next: ChangeEntry | undefined, nextRoot = root) => flushSync(() => r.render(<Probe root={nextRoot} entry={next} />)) };
}

type Step = { json: unknown; status?: number } | { text: string; status?: number } | Error | 'pending';
let steps: Step[];
let fetchMock: ReturnType<typeof vi.fn>;
const pending: Array<(response: Response) => void> = [];

beforeEach(() => {
  steps = [];
  pending.length = 0;
  fetchMock = vi.fn(() => {
    const step = steps.shift() ?? { json: someDiff };
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

describe('useFileDiff', () => {
  it('is idle and asks nothing with no entry', async () => {
    mount(undefined);
    expect(latest).toEqual({ status: 'idle' });
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // plan-git_explorer/REQ-12
  it('asks GET /api/git/diff with the root, the group and the file, and gives the diff', async () => {
    steps.push('pending');
    mount(modified);
    await settle();
    expect(latest).toEqual({ status: 'loading' });
    pending[0]!(new Response(JSON.stringify(someDiff)));
    await until(() => latest.status === 'loaded');
    expect(latest).toEqual({ status: 'loaded', diff: someDiff });
    const url = requestedUrl(0);
    expect(url.pathname).toBe('/api/git/diff');
    expect(url.searchParams.get('path')).toBe(ROOT);
    expect(url.searchParams.get('group')).toBe('unstaged');
    expect(url.searchParams.get('file')).toBe('src/a b.ts');
    expect(url.searchParams.has('oldPath')).toBe(false);
  });

  it('sends the oldPath of a rename', async () => {
    mount(renamed);
    await until(() => latest.status === 'loaded');
    expect(requestedUrl(0).searchParams.get('group')).toBe('staged');
    expect(requestedUrl(0).searchParams.get('oldPath')).toBe('old.ts');
  });

  it('asks again for a new entry, is loading, and drops the answer for the previous entry', async () => {
    const otherDiff = { binary: true, cut: false, lines: [] };
    steps.push('pending', 'pending');
    const probe = mount(modified);
    probe.set(renamed);
    await settle();
    expect(latest).toEqual({ status: 'loading' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    pending[1]!(new Response(JSON.stringify(otherDiff)));
    await until(() => latest.status === 'loaded');
    pending[0]!(new Response(JSON.stringify(someDiff)));
    await settle();
    expect(latest).toEqual({ status: 'loaded', diff: otherDiff });
  });

  it('asks again when the root changes', async () => {
    const probe = mount(modified);
    await until(() => latest.status === 'loaded');
    probe.set(modified, '/other/root');
    await until(() => fetchMock.mock.calls.length === 2);
    expect(requestedUrl(1).searchParams.get('path')).toBe('/other/root');
  });

  it('gives the message of an error answer', async () => {
    steps.push({ json: { error: 'git_error', message: 'fatal: bad revision' }, status: 500 });
    mount(modified);
    await until(() => latest.status === 'error');
    expect(latest).toEqual({ status: 'error', message: 'fatal: bad revision' });
  });

  it.each<[string, Step]>([
    ['an error answer with no message', { json: { error: 'invalid_file' }, status: 400 }],
    ['a failed request', new Error('network down')],
    ['an answer that is not JSON', { text: 'oops' }],
    ['an answer of another shape', { json: { lines: 'none' } }],
  ])('gives the fallback message for %s', async (_name, step) => {
    steps.push(step);
    mount(modified);
    await until(() => latest.status === 'error');
    expect(latest).toEqual({ status: 'error', message: FALLBACK });
  });
});
