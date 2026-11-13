import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { snapshotTree, tempDir } from '../test-support.js';
import { ProjectMarkStore } from './project-mark-store.js';
import { registerProjectRemoveRoute } from './project-remove-route.js';

let app: FastifyInstance;
let marks: ProjectMarkStore;
let dir: string;
let dataDir: string;

const post = (body: unknown) =>
  app.inject({ method: 'POST', url: '/api/projects/remove', payload: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const savedFile = async () => JSON.parse(await readFile(path.join(dataDir, 'project-marks.json'), 'utf8')) as { favorites: string[]; removed: Record<string, string> };

beforeEach(async () => {
  dir = await tempDir('ai-client-project-remove-');
  dataDir = path.join(dir, 'data');
  marks = await ProjectMarkStore.load(dataDir);
  app = Fastify();
  registerProjectRemoveRoute(app, marks);
  await app.ready();
});

afterEach(async () => {
  await app.close();
  await rm(dir, { recursive: true, force: true });
});

describe('POST /api/projects/remove', () => {
  // plan-project_list_actions/REQ-13: the removal is recorded at the current server time and saved
  it('204 with no body; the folder is removed at the current server time and the file is saved', async () => {
    const before = Date.now();
    const response = await post({ folder: '/work/web-dashboard' });
    const after = Date.now();
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    const removedAt = marks.removals()['/work/web-dashboard']!;
    expect(Date.parse(removedAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(removedAt)).toBeLessThanOrEqual(after);
    expect(await savedFile()).toEqual({ favorites: [], removed: { '/work/web-dashboard': removedAt } });
  });

  // plan-project_list_actions/REQ-19
  it('clears the favorite mark of the folder', async () => {
    await marks.setFavorite('/work/a', true);
    await marks.setFavorite('/work/b', true);
    expect((await post({ folder: '/work/a' })).statusCode).toBe(204);
    expect(marks.isFavorite('/work/a')).toBe(false);
    expect((await savedFile()).favorites).toEqual(['/work/b']);
  });

  // plan-project_list_actions/REQ-18
  it('removes a folder that does not exist on disk', async () => {
    const missing = path.join(dir, 'deleted', 'project');
    const response = await post({ folder: missing });
    expect(response.statusCode).toBe(204);
    expect(Object.keys(marks.removals())).toEqual([missing]);
  });

  // plan-project_list_actions/REQ-14: it writes only the ProjectMarkStore file
  it('deletes nothing: the project folder and its files stay, and only the marks file is written', async () => {
    const project = path.join(dir, 'project');
    await mkdir(path.join(project, 'src'), { recursive: true });
    await writeFile(path.join(project, 'src', 'main.ts'), 'kept');
    const projectBefore = await snapshotTree(project);
    expect((await post({ folder: project })).statusCode).toBe(204);
    expect(await snapshotTree(project)).toEqual(projectBefore);
    expect(await readdir(dataDir)).toEqual(['project-marks.json']);
  });

  it('stores the folder as sent', async () => {
    await post({ folder: '/work/a/' });
    expect(Object.keys(marks.removals())).toEqual(['/work/a/']);
  });

  it.each([
    ['a relative path', 'work/a'],
    ['an empty path', ''],
    ['a number', 42],
    ['null', null],
    ['a missing folder', undefined],
  ])('400 invalid_path for %s, and nothing changes', async (_name, folder) => {
    const response = await post({ folder });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_path' });
    expect(marks.removals()).toEqual({});
  });
});
