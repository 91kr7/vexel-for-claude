import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { PlanLimitsResult } from './plan-limits-reader.js';
import { registerPlanUsageRoute } from './plan-usage-route.js';

// REQ tests at the REST API of plan-usage_limits, batch plan-usage-view: a fake reader stands in for the Anthropic call.
const apps: FastifyInstance[] = [];

async function routeWith(read: () => Promise<PlanLimitsResult>): Promise<FastifyInstance> {
  const app = Fastify();
  registerPlanUsageRoute(app, { read });
  await app.ready();
  apps.push(app);
  return app;
}

const get = (app: FastifyInstance) => app.inject({ method: 'GET', url: '/api/plan-usage' });

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

describe('GET /api/plan-usage', () => {
  const ok: PlanLimitsResult = { status: 'ok', limits: [{ label: 'Current session', percent: 40, resetsAt: '2026-11-14T18:30:00+01:00' }] };

  // plan-usage_limits/REQ-5, REQ-6, REQ-11: the result of the reader, with the limits
  it('answers 200 with the limits of an ok read', async () => {
    const response = await get(await routeWith(async () => ok));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(ok);
  });

  // plan-usage_limits/REQ-13: unavailable -> 200 with the status only, no figures
  it('answers 200 { status: "unavailable" } with no limits', async () => {
    const response = await get(await routeWith(async () => ({ status: 'unavailable' })));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'unavailable' });
  });

  // plan-usage_limits/REQ-14: error -> 200 with the status only
  it('answers 200 { status: "error" } on a failed read', async () => {
    const response = await get(await routeWith(async () => ({ status: 'error' })));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'error' });
  });

  // spec: a reader that throws gives error
  it.each([
    ['rejects', () => Promise.reject(new Error('token fake-secret'))],
    ['throws at once', () => {
      throw new Error('token fake-secret');
    }],
  ])('answers 200 { status: "error" } when the reader %s', async (_name, read) => {
    const response = await get(await routeWith(read as () => Promise<PlanLimitsResult>));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'error' });
    expect(response.body).not.toContain('fake-secret');
  });

  // plan-usage_limits/REQ-17 (spec): overlapping calls share one read; the next call starts a new one
  it('shares one read between overlapping calls and starts a new one after it ends', async () => {
    let calls = 0;
    let release: (result: PlanLimitsResult) => void = () => {};
    const app = await routeWith(() => {
      calls += 1;
      return new Promise<PlanLimitsResult>((resolve) => {
        release = resolve;
      });
    });
    const first = get(app);
    const second = get(app);
    const third = get(app);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).toBe(1);
    release(ok);
    const responses = await Promise.all([first, second, third]);
    expect(responses.map((response) => response.json())).toEqual([ok, ok, ok]);
    const later = get(app);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).toBe(2);
    release({ status: 'unavailable' });
    expect((await later).json()).toEqual({ status: 'unavailable' });
  });

  it('keeps nothing after a failed read', async () => {
    const results: PlanLimitsResult[] = [{ status: 'error' }, ok];
    const app = await routeWith(async () => results.shift() ?? { status: 'error' });
    expect((await get(app)).json()).toEqual({ status: 'error' });
    expect((await get(app)).json()).toEqual(ok);
  });
});
