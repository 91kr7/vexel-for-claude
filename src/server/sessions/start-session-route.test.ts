import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FAKE_CLI, delay, tempDir } from '../test-support.js';
import { SessionRegistry } from './session-registry.js';
import { registerStartSessionRoute } from './start-session-route.js';

let app: FastifyInstance;
let registry: SessionRegistry;
let projectDir: string;
const startedIds: string[] = [];

beforeAll(async () => {
  projectDir = await tempDir();
  await writeFile(path.join(projectDir, 'a-file.txt'), 'x');
  registry = new SessionRegistry({ command: FAKE_CLI });
  app = Fastify();
  registerStartSessionRoute(app, registry);
  await app.ready();
});

afterAll(async () => {
  for (const id of startedIds) registry.get(id)?.write('/exit\r');
  await delay(200);
  await app.close();
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/sessions', () => {
  it('201 with the id of a session started in the folder', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/sessions', payload: { path: projectDir } });
    expect(response.statusCode).toBe(201);
    const { id } = response.json<{ id: string }>();
    startedIds.push(id);
    expect(registry.get(id)?.cwd).toBe(projectDir);
  });

  it.each([
    ['missing', {}],
    ['not a string', { path: 42 }],
    ['relative', { path: 'some/relative/dir' }],
  ])('400 invalid_path when path is %s, and no session starts', async (_label, payload) => {
    const start = vi.spyOn(registry, 'start');
    const response = await app.inject({ method: 'POST', url: '/api/sessions', payload });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_path' });
    expect(start).not.toHaveBeenCalled();
  });

  it.each([
    ['does not exist', () => path.join(projectDir, 'missing')],
    ['is a file', () => path.join(projectDir, 'a-file.txt')],
  ])('404 folder_not_found when the path %s, and no session starts', async (_label, target) => {
    const start = vi.spyOn(registry, 'start');
    const response = await app.inject({ method: 'POST', url: '/api/sessions', payload: { path: target() } });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'folder_not_found' });
    expect(start).not.toHaveBeenCalled();
  });
});
