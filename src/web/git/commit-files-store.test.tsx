// @vitest-environment jsdom
// Unit tests of useCommitFiles (plan-git_explorer, batch history).
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type CommitFile, type CommitFilesState, useCommitFiles } from './commit-files-store';

const FALLBACK = 'Could not read the files of the commit.';
const ROOT = '/home/dev/project';
const HASH = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const files: CommitFile[] = [
  { kind: 'modified', path: 'src/a.ts', binary: false },
  { kind: 'renamed', path: 'new.ts', oldPath: 'old.ts', binary: false },
];

let latest: CommitFilesState;
const roots: Root[] = [];

function Probe({ root, hash }: { root: string; hash: string }) {
  latest = useCommitFiles(root, hash);
  return null;
}

function mount(hash = HASH, root = ROOT) {
  const r = createRoot(document.createElement('div'));
  roots.push(r);
  flushSync(() => r.render(<Probe root={root} hash={hash} />));
  return { set: (next: string, nextRoot = root) => flushSync(() => r.render(<Probe root={nextRoot} hash={next} />)) };
}

type Step = { json: unknown; status?: number } | { text: string; status?: number } | Error | 'pending';
let steps: Step[];
let fetchMock: ReturnType<typeof vi.fn>;
const pending: Array<(response: Response) => void> = [];

beforeEach(() => {
  steps = [];
  pending.length = 0;
  fetchMock = vi.fn(() => {
    const step = steps.shift() ?? { json: { files } };
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

describe('useCommitFiles', () => {
  // plan-git_explorer/REQ-18
  it('asks GET /api/git/commit-files with the root and the hash, and gives the files', async () => {
    steps.push('pending');
    mount();
    await settle();
    expect(latest).toEqual({ status: 'loading' });
    pending[0]!(new Response(JSON.stringify({ files })));
    await until(() => latest.status === 'loaded');
    expect(latest).toEqual({ status: 'loaded', files });
    const url = requestedUrl(0);
    expect(url.pathname).toBe('/api/git/commit-files');
    expect(url.searchParams.get('path')).toBe(ROOT);
    expect(url.searchParams.get('hash')).toBe(HASH);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('asks again for a new hash, is loading, and drops the answer for the previous commit', async () => {
    const otherFiles: CommitFile[] = [{ kind: 'added', path: 'x.png', binary: true }];
    steps.push('pending', 'pending');
    const probe = mount();
    probe.set(OTHER);
    await settle();
    expect(latest).toEqual({ status: 'loading' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestedUrl(1).searchParams.get('hash')).toBe(OTHER);
    pending[1]!(new Response(JSON.stringify({ files: otherFiles })));
    await until(() => latest.status === 'loaded');
    pending[0]!(new Response(JSON.stringify({ files })));
    await settle();
    expect(latest).toEqual({ status: 'loaded', files: otherFiles });
  });

  it('asks again when the root changes', async () => {
    const probe = mount();
    await until(() => latest.status === 'loaded');
    probe.set(HASH, '/other/root');
    await until(() => fetchMock.mock.calls.length === 2);
    expect(requestedUrl(1).searchParams.get('path')).toBe('/other/root');
  });

  it('gives the message of an error answer', async () => {
    steps.push({ json: { error: 'git_error', message: 'fatal: bad object' }, status: 500 });
    mount();
    await until(() => latest.status === 'error');
    expect(latest).toEqual({ status: 'error', message: 'fatal: bad object' });
  });

  it.each<[string, Step]>([
    ['an error answer with no message', { json: { error: 'invalid_hash' }, status: 400 }],
    ['a failed request', new Error('network down')],
    ['an answer that is not JSON', { text: 'oops' }],
    ['an answer of another shape', { json: { files: 'none' } }],
  ])('gives the fallback message for %s', async (_name, step) => {
    steps.push(step);
    mount();
    await until(() => latest.status === 'error');
    expect(latest).toEqual({ status: 'error', message: FALLBACK });
  });
});
