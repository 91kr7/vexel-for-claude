import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { registerInstalledVersionRoute } from './installed-version-route.js';

// REQ tests at the REST API of plan-update_check, batch installed-version.
const apps: FastifyInstance[] = [];

async function routeWith(installedVersion: string): Promise<FastifyInstance> {
  const app = Fastify();
  registerInstalledVersionRoute(app, installedVersion);
  await app.ready();
  apps.push(app);
  return app;
}

const get = (app: FastifyInstance) => app.inject({ method: 'GET', url: '/api/installed-version' });

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

describe('GET /api/installed-version', () => {
  // plan-update_check/REQ-14
  it('answers 200 with the version given at registration, with no "v" added', async () => {
    const response = await get(await routeWith('0.2.2'));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ version: '0.2.2' });
  });

  // spec InstalledVersionRoute: every call of the same server start gives the same version
  it('gives the same version to every call', async () => {
    const app = await routeWith('1.4.0');
    const answers = await Promise.all([get(app), get(app), get(app)]);
    for (const response of answers) expect(response.json()).toEqual({ version: '1.4.0' });
  });
});
