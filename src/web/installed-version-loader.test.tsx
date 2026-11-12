// @vitest-environment jsdom
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInstalledVersion } from './installed-version-loader';

// Unit tests of the installed version loader: a fake fetch stands in for the route.
let latest: string | null;
const roots: Root[] = [];

function Probe() {
  latest = useInstalledVersion();
  return null;
}

// The shell may export NODE_ENV=production, where React has no `act`: flushSync commits the render and its effects at once.
function mount(): Root {
  const root = createRoot(document.createElement('div'));
  roots.push(root);
  flushSync(() => root.render(<Probe />));
  return root;
}

type Step = { json?: unknown; text?: string; status?: number } | Error | 'pending';
let step: Step;
let fetchMock: ReturnType<typeof vi.fn>;
let signals: AbortSignal[];
let release: ((response: Response) => void) | undefined;

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => {
  latest = null;
  signals = [];
  release = undefined;
  step = { json: { version: '0.2.2' } };
  fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.signal) signals.push(init.signal);
    if (step === 'pending') return new Promise<Response>((resolve) => (release = resolve));
    if (step instanceof Error) return Promise.reject(step);
    const body = step.text ?? JSON.stringify(step.json);
    return Promise.resolve(new Response(body, { status: step.status ?? 200 }));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  vi.unstubAllGlobals();
});

describe('useInstalledVersion', () => {
  // plan-update_check/REQ-15, spec useInstalledVersion: one request per mount, to the page's own server
  it('asks the page own server once per mount, and gives null until it answers', async () => {
    step = 'pending';
    mount();
    expect(latest).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/installed-version');
    release!(new Response(JSON.stringify({ version: '0.2.2' }), { status: 200 }));
    await vi.waitFor(() => expect(latest).toBe('0.2.2'));
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // plan-update_check/REQ-13
  it('gives the version text of a 200 answer as it is', async () => {
    mount();
    await vi.waitFor(() => expect(latest).toBe('0.2.2'));
  });

  // spec useInstalledVersion: network error
  it('gives null on a network error', async () => {
    step = new TypeError('fetch failed');
    mount();
    await settle();
    expect(latest).toBeNull();
  });

  // spec useInstalledVersion: status other than 200
  it('gives null on a status other than 200', async () => {
    step = { json: { version: '0.2.2' }, status: 500 };
    mount();
    await settle();
    expect(latest).toBeNull();
  });

  // spec useInstalledVersion: body of the wrong shape
  it.each([
    ['no version field', { json: {} }],
    ['an empty version', { json: { version: '' } }],
    ['a version that is not text', { json: { version: 22 } }],
    ['a null body', { json: null }],
    ['a body that is not JSON', { text: '<html>' }],
  ])('gives null on a body of the wrong shape: %s', async (_label, wrong) => {
    step = wrong;
    mount();
    await settle();
    expect(latest).toBeNull();
  });

  // spec useInstalledVersion: unmount
  it('aborts the request in flight on unmount, and a late answer changes nothing', async () => {
    step = 'pending';
    const root = mount();
    expect(signals).toHaveLength(1);
    root.unmount();
    roots.splice(roots.indexOf(root), 1);
    expect(signals[0]!.aborted).toBe(true);
    release!(new Response(JSON.stringify({ version: '0.2.2' }), { status: 200 }));
    await settle();
    expect(latest).toBeNull();
  });
});
