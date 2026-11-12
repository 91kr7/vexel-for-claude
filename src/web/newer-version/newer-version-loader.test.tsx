// @vitest-environment jsdom
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type NewerVersion, useNewerVersion } from './newer-version-loader';

// Unit tests of the newer version loader, plan-update_check/REQ-9, REQ-11: a fake fetch stands in for the route.
const VERSION: NewerVersion = { installedVersion: '0.1.0', newerVersion: '0.2.0', releaseUrl: 'https://github.com/owner/name/releases/tag/v0.2.0' };

let latest: NewerVersion | null;
let renders: number;
const roots: Root[] = [];

function Probe() {
  latest = useNewerVersion();
  renders += 1;
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

beforeEach(() => {
  latest = null;
  renders = 0;
  signals = [];
  release = undefined;
  step = { json: { status: 'none' } };
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
  vi.useRealTimers();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
const until = (check: () => boolean) => vi.waitFor(() => expect(check()).toBe(true));

describe('useNewerVersion', () => {
  it('is null until the route answers, then gives the newer version', async () => {
    step = 'pending';
    mount();
    expect(latest).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/newer-version');
    release?.(new Response(JSON.stringify({ status: 'newer', ...VERSION }), { status: 200 }));
    await until(() => latest !== null);
    expect(latest).toEqual(VERSION);
  });

  // one request per mount, no periodic refresh
  it('asks the route once per mount and never again', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    step = { json: { status: 'newer', ...VERSION } };
    mount();
    await vi.waitFor(() => expect(latest).toEqual(VERSION));
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('asks again on a new mount, as a reload does', async () => {
    step = { json: { status: 'newer', ...VERSION } };
    const first = mount();
    await until(() => latest !== null);
    first.unmount();
    roots.splice(roots.indexOf(first), 1);
    latest = null;
    mount();
    await until(() => latest !== null);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // plan-update_check/REQ-4: no newer version -> no notice
  it('stays null on status none', async () => {
    step = { json: { status: 'none' } };
    mount();
    await settle();
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(latest).toBeNull();
  });

  // plan-update_check/REQ-9: a failed request gives no notice and no error
  it.each<[string, Step]>([
    ['a network error', new TypeError('Failed to fetch')],
    ['a 500', { status: 500, json: { status: 'newer', ...VERSION } }],
    ['a 404', { status: 404, json: { message: 'Not Found' } }],
    ['a body that is not JSON', { text: '<html></html>' }],
    ['a newer answer without releaseUrl', { json: { status: 'newer', installedVersion: '0.1.0', newerVersion: '0.2.0' } }],
    ['a newer answer with a version that is not text', { json: { status: 'newer', ...VERSION, newerVersion: 2 } }],
    ['an unknown status', { json: { status: 'later', ...VERSION } }],
    ['a JSON null', { json: null }],
  ])('stays null on %s', async (_name, failing) => {
    step = failing;
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      mount();
      await settle();
      await settle();
      expect(latest).toBeNull();
      expect(errors).not.toHaveBeenCalled();
    } finally {
      errors.mockRestore();
    }
  });

  // plan-update_check/REQ-11: the request runs in the background, the page renders without waiting
  it('does not hold the render while the request waits', () => {
    step = 'pending';
    mount();
    expect(renders).toBeGreaterThan(0);
    expect(latest).toBeNull();
  });

  it('aborts the request in flight on unmount, and a late answer changes nothing', async () => {
    step = 'pending';
    const root = mount();
    expect(signals).toHaveLength(1);
    root.unmount();
    roots.splice(roots.indexOf(root), 1);
    expect(signals[0]?.aborted).toBe(true);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const rendersBefore = renders;
      release?.(new Response(JSON.stringify({ status: 'newer', ...VERSION }), { status: 200 }));
      await settle();
      expect(renders).toBe(rendersBefore);
      expect(latest).toBeNull();
      expect(errors).not.toHaveBeenCalled();
    } finally {
      errors.mockRestore();
    }
  });
});
