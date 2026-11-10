// @vitest-environment jsdom
// Unit tests of useChanges (plan-git_explorer, batch uncommitted-changes).
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ChangesState, useChanges } from './changes-store';

const FALLBACK = 'Could not read the changes.';
const someChanges = [
  { group: 'staged', kind: 'renamed', path: 'b.txt', oldPath: 'a.txt' },
  { group: 'unstaged', kind: 'untracked', path: 'c.txt' },
];

let latest: ChangesState;
const roots: Root[] = [];

function Probe({ root }: { root: string | undefined }) {
  latest = useChanges(root);
  return null;
}

function mount(root: string | undefined) {
  const r = createRoot(document.createElement('div'));
  roots.push(r);
  flushSync(() => r.render(<Probe root={root} />));
  return { setRoot: (next: string | undefined) => flushSync(() => r.render(<Probe root={next} />)) };
}

type Step = { json: unknown; status?: number } | { text: string; status?: number } | Error | 'pending';
let steps: Step[];
let fetchMock: ReturnType<typeof vi.fn>;
const pending: Array<(response: Response) => void> = [];

beforeEach(() => {
  steps = [];
  pending.length = 0;
  fetchMock = vi.fn(() => {
    const step = steps.shift() ?? { json: { changes: [] } };
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

describe('useChanges', () => {
  it('is loading and asks nothing while the root is undefined', async () => {
    mount(undefined);
    expect(latest).toEqual({ status: 'loading' });
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // plan-git_explorer/REQ-9
  it('asks GET /api/git/changes once with the root and gives the changes', async () => {
    steps.push('pending');
    mount('/home/dev/my project');
    await settle();
    expect(latest).toEqual({ status: 'loading' });
    pending[0]!(new Response(JSON.stringify({ changes: someChanges })));
    await until(() => latest.status === 'loaded');
    expect(latest).toEqual({ status: 'loaded', changes: someChanges });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedUrl(0).pathname).toBe('/api/git/changes');
    expect(requestedUrl(0).searchParams.get('path')).toBe('/home/dev/my project');
  });

  it('asks again only when the root changes, and drops the answer for the previous root', async () => {
    steps.push('pending', { json: { changes: someChanges } });
    const probe = mount('/repo/one');
    probe.setRoot('/repo/one');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    probe.setRoot('/repo/two');
    await until(() => latest.status === 'loaded');
    pending[0]!(new Response(JSON.stringify({ changes: [] })));
    await settle();
    expect(latest).toEqual({ status: 'loaded', changes: someChanges });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestedUrl(1).searchParams.get('path')).toBe('/repo/two');
  });

  it('is loading again when the root changes', async () => {
    steps.push({ json: { changes: [] } }, 'pending');
    const probe = mount('/repo/one');
    await until(() => latest.status === 'loaded');
    probe.setRoot('/repo/two');
    await until(() => latest.status === 'loading');
    await settle();
    expect(latest).toEqual({ status: 'loading' });
  });

  // plan-git_explorer/REQ-6
  it('gives the message of an error answer', async () => {
    steps.push({ json: { error: 'git_error', message: 'fatal: bad object HEAD' }, status: 500 });
    mount('/repo');
    await until(() => latest.status === 'error');
    expect(latest).toEqual({ status: 'error', message: 'fatal: bad object HEAD' });
  });

  it.each<[string, Step]>([
    ['an error answer with no message', { json: { error: 'invalid_path' }, status: 400 }],
    ['a failed request', new Error('network down')],
    ['an answer that is not JSON', { text: 'oops' }],
    ['an answer with no changes list', { json: { changes: 'none' } }],
  ])('gives the fallback message for %s', async (_name, step) => {
    steps.push(step);
    mount('/repo');
    await until(() => latest.status === 'error');
    expect(latest).toEqual({ status: 'error', message: FALLBACK });
  });

  it('asks no more after the answer', async () => {
    mount('/repo');
    await until(() => latest.status === 'loaded');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
