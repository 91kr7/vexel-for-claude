// @vitest-environment jsdom
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type RepositoryLookupState, useRepositoryLookup } from './repository-lookup-store';

const FALLBACK = 'Could not read the repository.';
const repositoryBody = { status: 'repository', root: '/home/dev/project', branch: { kind: 'branch', name: 'main' } };

let latest: RepositoryLookupState;
const roots: Root[] = [];

function Probe({ folder }: { folder: string | undefined }) {
  latest = useRepositoryLookup(folder);
  return null;
}

// flushSync commits the render and its effects at once, also where NODE_ENV=production leaves React without `act`.
function mount(folder: string | undefined) {
  const root = createRoot(document.createElement('div'));
  roots.push(root);
  flushSync(() => root.render(<Probe folder={folder} />));
  return { setFolder: (next: string | undefined) => flushSync(() => root.render(<Probe folder={next} />)) };
}

type Step = { json: unknown; status?: number } | { text: string; status?: number } | Error | 'pending';
let steps: Step[];
let fetchMock: ReturnType<typeof vi.fn>;
const pending: Array<(response: Response) => void> = [];

beforeEach(() => {
  steps = [];
  pending.length = 0;
  fetchMock = vi.fn(() => {
    const step = steps.shift() ?? { json: { status: 'none' } };
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

describe('useRepositoryLookup', () => {
  it('is loading and asks nothing while the folder is undefined', async () => {
    mount(undefined);
    expect(latest).toEqual({ status: 'loading' });
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(latest).toEqual({ status: 'loading' });
  });

  // plan-git_explorer/REQ-1: one request for the folder, then the repository
  it('is loading, then gives the repository of the answer', async () => {
    steps = ['pending'];
    mount('/home/dev/project/sub');
    expect(latest).toEqual({ status: 'loading' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = requestedUrl(0);
    expect(url.pathname).toBe('/api/git/repository');
    expect(url.searchParams.get('path')).toBe('/home/dev/project/sub');
    pending[0]!(new Response(JSON.stringify(repositoryBody)));
    await until(() => latest.status === 'repository');
    expect(latest).toEqual(repositoryBody);
  });

  it('gives a detached HEAD as it comes', async () => {
    const detached = { status: 'repository', root: '/r', branch: { kind: 'detached', hash: 'a1b2c3d' } };
    steps = [{ json: detached }];
    mount('/r');
    await until(() => latest.status === 'repository');
    expect(latest).toEqual(detached);
  });

  // plan-git_explorer/REQ-2
  it('gives none when the folder is not in a repository', async () => {
    steps = [{ json: { status: 'none' } }];
    mount('/tmp/plain');
    await until(() => latest.status === 'none');
    expect(latest).toEqual({ status: 'none' });
  });

  // plan-git_explorer/REQ-6
  it('gives the message of an error answer', async () => {
    steps = [{ json: { error: 'git_error', message: 'fatal: bad object HEAD' }, status: 500 }];
    mount('/r');
    await until(() => latest.status === 'error');
    expect(latest).toEqual({ status: 'error', message: 'fatal: bad object HEAD' });
  });

  it.each<[string, Step]>([
    ['an error answer with no message', { json: { error: 'invalid_path' }, status: 400 }],
    ['a failed request', new Error('network down')],
    ['an answer of another shape', { json: { status: 'maybe' } }],
    ['an answer that is not JSON', { text: '<html>' }],
  ])('gives the fallback message for %s', async (_name, step) => {
    steps = [step];
    mount('/r');
    await until(() => latest.status === 'error');
    expect(latest).toEqual({ status: 'error', message: FALLBACK });
  });

  it('asks once per folder: no new request on a re-render, no periodic request', async () => {
    steps = [{ json: repositoryBody }];
    const view = mount('/r');
    await until(() => latest.status === 'repository');
    view.setFolder('/r');
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('asks again on a new folder, is loading meanwhile, and drops the answer of the previous folder', async () => {
    steps = ['pending', 'pending'];
    const view = mount('/old');
    view.setFolder('/new');
    expect(latest).toEqual({ status: 'loading' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestedUrl(1).searchParams.get('path')).toBe('/new');
    pending[0]!(new Response(JSON.stringify({ status: 'repository', root: '/old', branch: { kind: 'branch', name: 'old' } })));
    await settle();
    expect(latest).toEqual({ status: 'loading' });
    pending[1]!(new Response(JSON.stringify({ status: 'none' })));
    await until(() => latest.status === 'none');
    await settle();
    expect(latest).toEqual({ status: 'none' });
  });

  it('is loading again after a folder change that follows an answer', async () => {
    steps = [{ json: repositoryBody }, 'pending'];
    const view = mount('/r');
    await until(() => latest.status === 'repository');
    view.setFolder('/s');
    await settle();
    expect(latest).toEqual({ status: 'loading' });
  });
});
