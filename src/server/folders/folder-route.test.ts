import { chmod, mkdir, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tempDir } from '../test-support.js';
import { registerFolderRoute } from './folder-route.js';

let app: FastifyInstance;
let root: string;
const runsAsRoot = process.getuid?.() === 0;

beforeAll(async () => {
  root = await tempDir();
  for (const name of ['zeta', 'alpha', '.hidden', 'beta', 'locked']) await mkdir(path.join(root, name));
  await writeFile(path.join(root, 'file.txt'), 'x');
  await symlink(path.join(root, 'alpha'), path.join(root, 'link-to-alpha'));
  await chmod(path.join(root, 'locked'), 0o000);
  app = Fastify();
  registerFolderRoute(app);
  await app.ready();
});

afterAll(async () => {
  await chmod(path.join(root, 'locked'), 0o755);
  await app.close();
});

const list = (query?: string) => app.inject({ method: 'GET', url: `/api/folders${query ?? ''}` });

describe('GET /api/folders', () => {
  it('lists subfolders sorted by name, hidden ones included, without files or symlinks', async () => {
    const response = await list(`?path=${encodeURIComponent(root)}`);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      path: root,
      parent: path.dirname(root),
      folders: ['.hidden', 'alpha', 'beta', 'locked', 'zeta'],
    });
  });

  it('without path lists the user home', async () => {
    const response = await list();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ path: os.homedir(), parent: path.dirname(os.homedir()) });
  });

  it('normalizes the path: no trailing slash, no . or ..', async () => {
    const response = await list(`?path=${encodeURIComponent(`${root}/./alpha/../beta/`)}`);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ path: path.join(root, 'beta'), parent: root, folders: [] });
  });

  it('parent is null for /', async () => {
    const response = await list('?path=%2F');
    expect(response.statusCode).toBe(200);
    const body = response.json<{ path: string; parent: string | null; folders: string[] }>();
    expect(body.path).toBe('/');
    expect(body.parent).toBeNull();
    expect(body.folders).toContain('tmp');
  });

  it('400 invalid_path for a relative path', async () => {
    const response = await list('?path=relative%2Fdir');
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_path' });
  });

  it.each([
    ['does not exist', 'missing'],
    ['is a file', 'file.txt'],
  ])('404 folder_not_found when the path %s', async (_label, name) => {
    const response = await list(`?path=${encodeURIComponent(path.join(root, name))}`);
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'folder_not_found' });
  });

  it.skipIf(runsAsRoot)('403 folder_not_readable when the folder cannot be read', async () => {
    const response = await list(`?path=${encodeURIComponent(path.join(root, 'locked'))}`);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'folder_not_readable' });
  });
});
