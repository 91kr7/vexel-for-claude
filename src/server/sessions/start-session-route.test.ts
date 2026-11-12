import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FAKE_CLI, delay, tempDir } from '../test-support.js';
import { SessionNameStore } from './session-name-store.js';
import { SessionRegistry } from './session-registry.js';
import { registerStartSessionRoute } from './start-session-route.js';

let app: FastifyInstance;
let registry: SessionRegistry;
let projectDir: string;
let names: SessionNameStore;
let claudeSessionIdOf: (id: string) => string | undefined = () => undefined;
const startedIds: string[] = [];

beforeAll(async () => {
  projectDir = await tempDir();
  await writeFile(path.join(projectDir, 'a-file.txt'), 'x');
  registry = new SessionRegistry({ command: FAKE_CLI });
  app = Fastify();
  names = new SessionNameStore();
  registerStartSessionRoute(app, { registry, tracker: { claudeSessionId: (id: string) => claudeSessionIdOf(id) }, names });
  await app.ready();
});

afterAll(async () => {
  for (const id of startedIds) registry.get(id)?.write('/exit\r');
  await delay(200);
  await app.close();
});

beforeEach(() => {
  vi.restoreAllMocks();
  claudeSessionIdOf = () => undefined;
});

async function start(payload: object) {
  const response = await app.inject({ method: 'POST', url: '/api/sessions', payload });
  if (response.statusCode === 201) startedIds.push(response.json<{ id: string }>().id);
  return response;
}

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

  // plan-recent_projects/REQ-16, REQ-18: the trimmed name is held before the 201, under the session id when there is no Claude Code session id
  it('201 and the trimmed name held for the session id', async () => {
    const response = await start({ path: projectDir, name: '  Rate limiter tests  ' });
    expect(response.statusCode).toBe(201);
    const { id } = response.json<{ id: string }>();
    expect(registry.get(id)?.cwd).toBe(projectDir);
    expect(names.get(id)).toBe('Rate limiter tests');
  });

  // StartSessionRoute: the key follows RenameSessionRoute, the Claude Code session id first
  it('holds the name for the Claude Code session id when the tracker knows it', async () => {
    claudeSessionIdOf = (id) => `claude-of-${id}`;
    const response = await start({ path: projectDir, name: 'Named' });
    expect(response.statusCode).toBe(201);
    const { id } = response.json<{ id: string }>();
    expect(names.get(`claude-of-${id}`)).toBe('Named');
    expect(names.get(id)).toBeUndefined();
  });

  // plan-recent_projects/REQ-19
  it.each([
    ['missing', {}],
    ['empty', { name: '' }],
    ['spaces only', { name: '   ' }],
  ])('201 and no name set when the name is %s', async (_label, extra) => {
    const set = vi.spyOn(names, 'set');
    const response = await start({ path: projectDir, ...extra });
    expect(response.statusCode).toBe(201);
    const { id } = response.json<{ id: string }>();
    expect(registry.get(id)?.cwd).toBe(projectDir);
    expect(set).not.toHaveBeenCalled();
    expect(names.get(id)).toBeUndefined();
  });

  // plan-recent_projects/REQ-18: at most 200 characters after trim, counted as code points
  it('accepts a name of 200 characters after trim, counted as code points', async () => {
    const name = '😀'.repeat(200);
    const response = await start({ path: projectDir, name: `  ${name}  ` });
    expect(response.statusCode).toBe(201);
    expect(names.get(response.json<{ id: string }>().id)).toBe(name);
  });

  // plan-recent_projects/REQ-18, REQ-22
  it('400 name_too_long above 200 characters after trim, and no session starts and no name is set', async () => {
    const start = vi.spyOn(registry, 'start');
    const set = vi.spyOn(names, 'set');
    const response = await app.inject({ method: 'POST', url: '/api/sessions', payload: { path: projectDir, name: '😀'.repeat(201) } });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'name_too_long' });
    expect(start).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it.each([
    ['a number', 42],
    ['a boolean', true],
    ['an object', { text: 'x' }],
  ])('400 invalid_name when the name is %s, and no session starts', async (_label, name) => {
    const start = vi.spyOn(registry, 'start');
    const set = vi.spyOn(names, 'set');
    const response = await app.inject({ method: 'POST', url: '/api/sessions', payload: { path: projectDir, name } });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_name' });
    expect(start).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  // StartSessionRoute rule: checks run in the order path, name, folder
  it('checks the path before the name, and the name before the folder', async () => {
    const start = vi.spyOn(registry, 'start');
    const missing = path.join(projectDir, 'missing');
    const answer = async (payload: object) => {
      const response = await app.inject({ method: 'POST', url: '/api/sessions', payload });
      return [response.statusCode, response.json()];
    };
    expect(await answer({ path: 'relative', name: 42 })).toEqual([400, { error: 'invalid_path' }]);
    expect(await answer({ path: missing, name: 42 })).toEqual([400, { error: 'invalid_name' }]);
    expect(await answer({ path: missing, name: 'x'.repeat(201) })).toEqual([400, { error: 'name_too_long' }]);
    expect(await answer({ path: missing, name: 'ok' })).toEqual([404, { error: 'folder_not_found' }]);
    expect(start).not.toHaveBeenCalled();
  });

  it('404 folder_not_found with a valid name sets no name', async () => {
    const set = vi.spyOn(names, 'set');
    const response = await app.inject({ method: 'POST', url: '/api/sessions', payload: { path: path.join(projectDir, 'missing'), name: 'ok' } });
    expect(response.statusCode).toBe(404);
    expect(set).not.toHaveBeenCalled();
  });
});
