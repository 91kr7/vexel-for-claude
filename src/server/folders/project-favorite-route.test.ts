import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tempDir } from '../test-support.js';
import { registerProjectFavoriteRoute } from './project-favorite-route.js';
import { ProjectMarkStore } from './project-mark-store.js';

let app: FastifyInstance;
let marks: ProjectMarkStore;
let dir: string;

const put = (body: unknown) =>
  app.inject({ method: 'PUT', url: '/api/projects/favorite', payload: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const savedFavorites = async () => (JSON.parse(await readFile(path.join(dir, 'project-marks.json'), 'utf8')) as { favorites: string[] }).favorites;

beforeEach(async () => {
  dir = await tempDir('ai-client-project-favorite-');
  marks = await ProjectMarkStore.load(dir);
  app = Fastify();
  registerProjectFavoriteRoute(app, marks);
  await app.ready();
});

afterEach(async () => {
  await app.close();
  await rm(dir, { recursive: true, force: true });
});

describe('PUT /api/projects/favorite', () => {
  // plan-project_list_actions/REQ-23: put the mark
  it('204 with no body; the folder is marked and the file is saved', async () => {
    const response = await put({ folder: '/work/web-dashboard', favorite: true });
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(marks.isFavorite('/work/web-dashboard')).toBe(true);
    expect(await savedFavorites()).toEqual(['/work/web-dashboard']);
  });

  // plan-project_list_actions/REQ-23: remove the mark
  it('204 with favorite false; the mark is cleared and saved', async () => {
    await put({ folder: '/work/web-dashboard', favorite: true });
    const response = await put({ folder: '/work/web-dashboard', favorite: false });
    expect(response.statusCode).toBe(204);
    expect(marks.isFavorite('/work/web-dashboard')).toBe(false);
    expect(await savedFavorites()).toEqual([]);
  });

  it('204 when the mark already has the asked value', async () => {
    const response = await put({ folder: '/work/a', favorite: false });
    expect(response.statusCode).toBe(204);
    expect(marks.isFavorite('/work/a')).toBe(false);
  });

  // plan-project_list_actions/REQ-27
  it('marks a folder that does not exist on disk', async () => {
    const missing = path.join(dir, 'deleted', 'project');
    const response = await put({ folder: missing, favorite: true });
    expect(response.statusCode).toBe(204);
    expect(marks.isFavorite(missing)).toBe(true);
  });

  it('stores the folder as sent', async () => {
    await put({ folder: '/work/a/', favorite: true });
    expect(marks.isFavorite('/work/a/')).toBe(true);
    expect(marks.isFavorite('/work/a')).toBe(false);
  });

  it.each([
    ['a relative path', 'work/a'],
    ['an empty path', ''],
    ['a number', 42],
    ['null', null],
    ['a missing folder', undefined],
  ])('400 invalid_path for %s, and nothing changes', async (_name, folder) => {
    const response = await put({ folder, favorite: true });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_path' });
    expect(marks.favorites()).toEqual([]);
  });

  it.each([
    ['a string', 'true'],
    ['a number', 1],
    ['null', null],
    ['a missing favorite', undefined],
  ])('400 invalid_favorite for %s, and nothing changes', async (_name, favorite) => {
    const response = await put({ folder: '/work/a', favorite });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_favorite' });
    expect(marks.favorites()).toEqual([]);
  });
});
