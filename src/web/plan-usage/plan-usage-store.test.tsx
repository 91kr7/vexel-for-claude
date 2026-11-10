// @vitest-environment jsdom
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type PlanUsageState, usePlanUsage } from './plan-usage-store';

const LIMITS = [{ label: 'Current session', percent: 40, resetsAt: '2026-11-14T18:30:00+01:00' }];
const okBody = (percent = 40) => ({ status: 'ok', limits: [{ ...LIMITS[0], percent }] });

let latest: PlanUsageState;
const roots: Root[] = [];

function Probe({ open }: { open: boolean }) {
  latest = usePlanUsage(open);
  return null;
}

// The shell may export NODE_ENV=production, where React has no `act`: flushSync commits the render and its effects at once.
function mount(open: boolean) {
  const root = createRoot(document.createElement('div'));
  roots.push(root);
  flushSync(() => root.render(<Probe open={open} />));
  return { setOpen: (next: boolean) => flushSync(() => root.render(<Probe open={next} />)) };
}

type Step = { json: unknown; status?: number } | Error | 'pending';
let steps: Step[];
let fetchMock: ReturnType<typeof vi.fn>;
let signals: AbortSignal[];
const pendingResolvers: Array<(response: Response) => void> = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(new Date(2026, 10, 9, 12, 0, 0));
  steps = [];
  signals = [];
  pendingResolvers.length = 0;
  fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.signal) signals.push(init.signal);
    const step = steps.shift() ?? { json: { status: 'error' } };
    if (step === 'pending') return new Promise<Response>((resolve) => pendingResolvers.push(resolve));
    if (step instanceof Error) return Promise.reject(step);
    return Promise.resolve(new Response(JSON.stringify(step.json), { status: step.status ?? 200 }));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));
const until = (check: () => boolean) => vi.waitFor(() => expect(check()).toBe(true));

describe('usePlanUsage', () => {
  // plan-usage_limits/REQ-11, REQ-17: closed -> loading and no request; open -> loading, then ready
  it('is loading and loads nothing while closed', async () => {
    mount(false);
    await settle();
    expect(latest).toEqual({ kind: 'loading' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('starts loading on open, requests /api/plan-usage and gives ready with the limits', async () => {
    steps = [{ json: okBody() }];
    mount(true);
    expect(latest).toEqual({ kind: 'loading' });
    await until(() => latest.kind === 'ready');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/plan-usage');
    expect(latest).toMatchObject({ kind: 'ready', limits: [LIMITS[0]] });
    expect(Math.abs((latest as { readAt: number }).readAt - Date.now())).toBeLessThan(1_000);
  });

  // loads once per opening: no periodic refresh while the popover stays open
  it('requests the usage once per opening and never refreshes while open', async () => {
    steps = [{ json: okBody(40) }, { json: okBody(45) }];
    mount(true);
    await until(() => latest.kind === 'ready');
    await vi.advanceTimersByTimeAsync(600_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(latest).toMatchObject({ kind: 'ready', limits: [{ percent: 40 }] });
  });

  // plan-usage_limits/REQ-13: a failed first load gives unavailable
  it.each<[string, Step]>([
    ['unavailable', { json: { status: 'unavailable' } }],
    ['error', { json: { status: 'error' } }],
    ['status 500', { json: { status: 'ok', limits: [] }, status: 500 }],
    ['a network error', new TypeError('failed')],
    ['ok with no limits', { json: { status: 'ok', limits: [] } }],
    ['ok with a limit of the wrong shape', { json: { status: 'ok', limits: [{ label: 'x', percent: 'high', resetsAt: null }] } }],
    ['a body of the wrong shape', { json: 'text' }],
  ])('gives unavailable on a first load with %s', async (_name, step) => {
    steps = [step];
    mount(true);
    await until(() => latest.kind === 'unavailable');
    expect(latest).toEqual({ kind: 'unavailable' });
  });

  // plan-usage_limits/REQ-11 and spec: closing aborts and resets to loading
  it('aborts the request in flight and resets to loading on close', async () => {
    steps = [{ json: okBody() }];
    const view = mount(true);
    await until(() => latest.kind === 'ready');
    view.setOpen(false);
    expect(latest).toEqual({ kind: 'loading' });
    expect(signals[0]?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(180_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ignores a late answer after close', async () => {
    steps = ['pending'];
    const view = mount(true);
    await until(() => pendingResolvers.length === 1);
    view.setOpen(false);
    pendingResolvers[0]?.(new Response(JSON.stringify(okBody()), { status: 200 }));
    await settle();
    expect(latest).toEqual({ kind: 'loading' });
  });

  // plan-usage_limits/REQ-11: the figures of an earlier opening are never shown as current
  it('drops the earlier figures when it opens again', async () => {
    steps = [{ json: okBody(40) }, 'pending'];
    const view = mount(true);
    await until(() => latest.kind === 'ready');
    view.setOpen(false);
    await settle();
    view.setOpen(true);
    expect(latest).toEqual({ kind: 'loading' });
    await until(() => pendingResolvers.length === 1);
    expect(latest).toEqual({ kind: 'loading' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives unavailable when the second opening fails after a good read of the first', async () => {
    steps = [{ json: okBody(40) }, { json: { status: 'error' } }];
    const view = mount(true);
    await until(() => latest.kind === 'ready');
    view.setOpen(false);
    await settle();
    view.setOpen(true);
    await until(() => latest.kind !== 'loading');
    expect(latest).toEqual({ kind: 'unavailable' });
  });
});
