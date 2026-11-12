import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { registerNewerVersionRoute } from './newer-version-route.js';
import type { ReleaseCheckResult } from './release-check.js';

// REQ tests at the REST API of plan-update_check: a given promise stands in for the launch's release check.
const apps: FastifyInstance[] = [];

async function routeWith(result: Promise<ReleaseCheckResult>): Promise<FastifyInstance> {
  const app = Fastify();
  registerNewerVersionRoute(app, result);
  await app.ready();
  apps.push(app);
  return app;
}

const get = (app: FastifyInstance) => app.inject({ method: 'GET', url: '/api/newer-version' });

const NEWER: ReleaseCheckResult = {
  status: 'newer',
  installedVersion: '0.1.0',
  newerVersion: '0.2.0',
  releaseUrl: 'https://github.com/owner/name/releases/tag/v0.2.0',
};

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

describe('GET /api/newer-version', () => {
  // plan-update_check/REQ-4, REQ-5
  it('answers 200 with both versions and the release page when a newer version exists', async () => {
    const response = await get(await routeWith(Promise.resolve(NEWER)));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(NEWER);
  });

  // plan-update_check/REQ-4
  it('answers 200 { status: "none" } when no newer version exists', async () => {
    const response = await get(await routeWith(Promise.resolve({ status: 'none' })));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'none' });
  });

  // plan-update_check/REQ-9: a failed check is never an error for the page
  it('answers 200 { status: "none" } when the check rejects', async () => {
    const failed = Promise.reject(new Error('fetch failed: secret-detail'));
    failed.catch(() => {});
    const response = await get(await routeWith(failed));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'none' });
    expect(response.body).not.toContain('secret-detail');
  });

  // spec: while the check runs, the answer waits for it
  it('waits for a running check and then answers with its result', async () => {
    let finish!: (result: ReleaseCheckResult) => void;
    const app = await routeWith(new Promise((resolve) => (finish = resolve)));
    let answered = false;
    const pending = get(app).then((response) => {
      answered = true;
      return response;
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(answered).toBe(false);
    finish(NEWER);
    const response = await pending;
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(NEWER);
  });

  // plan-update_check/REQ-2: every call of the same start gives the same result, as a reload or a new tab would ask
  it('gives the same result to every call', async () => {
    const app = await routeWith(Promise.resolve(NEWER));
    const answers = await Promise.all([get(app), get(app), get(app)]);
    for (const response of answers) expect(response.json()).toEqual(NEWER);
    expect((await get(app)).json()).toEqual(NEWER);
  });
});
