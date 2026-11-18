import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProcessRow } from './process-list.js';
import { registerProcessesRoute } from './processes-route.js';

// REQ tests at the REST API of plan-app_processes, batch processes-list: a fake ProcessList stands in for /proc.
const ROWS: ProcessRow[] = [
  { kind: 'test-server', pid: 10, startedAt: 1000, port: 3100, thisInstance: true, hosted: false, hanging: false },
  { kind: 'fake-claude', pid: 20, startedAt: 2000, folder: '/tmp/p', label: 'Fix', thisInstance: false, hosted: true, hanging: false },
];
const apps: FastifyInstance[] = [];

async function routeWith(list: () => Promise<ProcessRow[]>): Promise<FastifyInstance> {
  const app = Fastify();
  registerProcessesRoute(app, { list });
  await app.ready();
  apps.push(app);
  return app;
}

const get = (app: FastifyInstance) => app.inject({ method: 'GET', url: '/api/processes' });

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

describe('GET /api/processes', () => {
  // plan-app_processes/REQ-10, REQ-22
  it('answers 200 with the rows of the list, in their order', async () => {
    const response = await get(await routeWith(async () => ROWS));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ processes: ROWS });
  });

  // plan-app_processes/REQ-12
  it('answers 200 with an empty list when no process runs', async () => {
    const response = await get(await routeWith(async () => []));
    expect(response.json()).toEqual({ processes: [] });
  });

  // plan-app_processes/REQ-11: each call reads the list again
  it('reads the list at each call', async () => {
    const list = vi.fn(async () => ROWS);
    const app = await routeWith(list);
    await get(app);
    await get(app);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('answers 500 when the read fails', async () => {
    const response = await get(await routeWith(async () => Promise.reject(new Error('EACCES'))));
    expect(response.statusCode).toBe(500);
  });
});
