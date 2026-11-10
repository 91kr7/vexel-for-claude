// REQ tests at the REST API of plan-git_explorer, batch uncommitted-changes: GET /api/git/changes and GET /api/git/diff on real git repositories.
import { statSync } from 'node:fs';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { registerChangesRoutes } from './changes-route.js';
import { git, repoWithCommit, tempFolder } from './git-fixtures.js';
import { GitError, GitRunner } from './git-runner.js';

type Runner = Pick<GitRunner, 'run' | 'runCapped'>;

let dir: string;
/** Session on `<repo>/sub`: a staged new file there, an unstaged change in `other/`, an untracked file at the root. */
let repo: string;
const apps: FastifyInstance[] = [];

beforeAll(async () => {
  dir = await tempFolder('ai-client-changes-route-');
  repo = await repoWithCommit(dir, 'project');
  await mkdir(path.join(repo, 'other'));
  await writeFile(path.join(repo, 'other', 'code.ts'), 'const a = 1;\nconst b = 2;\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'second');
  await writeFile(path.join(repo, 'sub', 'new.txt'), 'hello\n');
  git(repo, 'add', 'sub/new.txt');
  await writeFile(path.join(repo, 'other', 'code.ts'), 'const a = 1;\nconst b = 3;\n');
  await writeFile(path.join(repo, 'scratch.md'), 'idea\n');
});

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function routeWith(runner: Runner = new GitRunner()): Promise<FastifyInstance> {
  const app = Fastify();
  registerChangesRoutes(app, runner);
  await app.ready();
  apps.push(app);
  return app;
}

const changes = (app: FastifyInstance, query: Record<string, string>) => app.inject({ method: 'GET', url: '/api/git/changes', query });
const diff = (app: FastifyInstance, query: Record<string, string>) => app.inject({ method: 'GET', url: '/api/git/diff', query });
const failing: Runner = {
  run: () => Promise.reject(new GitError('failed', 'fatal: bad object HEAD', 128)),
  runCapped: () => Promise.reject(new GitError('failed', 'fatal: bad object HEAD', 128)),
};

describe('GET /api/git/changes', () => {
  // plan-git_explorer/REQ-5, REQ-9, REQ-10, REQ-11
  it('answers 200 with every change of the whole repository, by group and kind', async () => {
    const response = await changes(await routeWith(), { path: path.join(repo, 'sub') });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { changes: Array<{ group: string; path: string }> };
    expect([...body.changes].sort((a, b) => a.path.localeCompare(b.path))).toEqual([
      { group: 'unstaged', kind: 'modified', path: 'other/code.ts' },
      { group: 'unstaged', kind: 'untracked', path: 'scratch.md' },
      { group: 'staged', kind: 'added', path: 'sub/new.txt' },
    ]);
  });

  // plan-git_explorer/REQ-13: an empty list for a clean repository
  it('answers 200 with an empty list for a clean repository', async () => {
    const clean = await repoWithCommit(dir, 'clean');
    const response = await changes(await routeWith(), { path: clean });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ changes: [] });
  });

  it('reads the normalized path', async () => {
    const response = await changes(await routeWith(), { path: `${repo}/sub/./../sub/` });
    expect(response.statusCode).toBe(200);
    expect((response.json() as { changes: unknown[] }).changes).toHaveLength(3);
  });

  it.each([
    ['missing', {}],
    ['empty', { path: '' }],
    ['relative', { path: 'project/sub' }],
  ])('answers 400 invalid_path when the path is %s', async (_name, query) => {
    const response = await changes(await routeWith(), query);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_path' });
  });

  // plan-git_explorer/REQ-6
  it('answers 500 git_error for a folder outside any repository', async () => {
    const plain = path.join(dir, 'plain');
    await mkdir(plain, { recursive: true });
    const response = await changes(await routeWith(), { path: plain });
    expect(response.statusCode).toBe(500);
    const body = response.json() as { error: string; message: string };
    expect(body.error).toBe('git_error');
    expect(body.message).toMatch(/not a git repository/i);
  });

  it('answers 500 git_error with the message of a git error', async () => {
    const response = await changes(await routeWith(failing), { path: repo });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'git_error', message: 'fatal: bad object HEAD' });
  });
});

describe('GET /api/git/diff', () => {
  // plan-git_explorer/REQ-12: the diff of a file in another folder of the repository, lines marked by kind
  it('answers 200 with the marked lines of an unstaged change', async () => {
    const response = await diff(await routeWith(), { path: path.join(repo, 'sub'), group: 'unstaged', file: 'other/code.ts' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { binary: boolean; cut: boolean; lines: Array<{ kind: string; text: string }> };
    expect(body.binary).toBe(false);
    expect(body.cut).toBe(false);
    expect(body.lines.filter((line) => line.kind !== 'hunk')).toEqual([
      { kind: 'context', text: 'const a = 1;' },
      { kind: 'removed', text: 'const b = 2;' },
      { kind: 'added', text: 'const b = 3;' },
    ]);
  });

  it('answers 200 with every line added for a staged new file and for an untracked file', async () => {
    const app = await routeWith();
    const staged = await diff(app, { path: repo, group: 'staged', file: 'sub/new.txt' });
    expect(staged.statusCode).toBe(200);
    expect((staged.json() as { lines: Array<{ kind: string }> }).lines.filter((l) => l.kind !== 'hunk')).toEqual([{ kind: 'added', text: 'hello' }]);
    const untracked = await diff(app, { path: repo, group: 'unstaged', file: 'scratch.md' });
    expect(untracked.statusCode).toBe(200);
    expect((untracked.json() as { lines: Array<{ kind: string }> }).lines.filter((l) => l.kind !== 'hunk')).toEqual([{ kind: 'added', text: 'idea' }]);
  });

  it('answers 200 for a rename given with its oldPath', async () => {
    const renamed = await repoWithCommit(dir, 'renamed');
    git(renamed, 'mv', 'sub/file.txt', 'sub/moved.txt');
    const response = await diff(await routeWith(), { path: renamed, group: 'staged', file: 'sub/moved.txt', oldPath: 'sub/file.txt' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ binary: false, cut: false, lines: [] });
  });

  // plan-git_explorer/REQ-14, REQ-15
  it('answers binary: true for a binary file and cut: true for a diff over 5,000 lines', async () => {
    const other = await repoWithCommit(dir, 'big');
    await writeFile(path.join(other, 'blob.bin'), Buffer.from([0, 1, 2, 0, 255]));
    await writeFile(path.join(other, 'big.txt'), Array.from({ length: 20_000 }, (_, i) => `line ${i}\n`).join(''));
    const app = await routeWith();
    expect((await diff(app, { path: other, group: 'unstaged', file: 'blob.bin' })).json()).toEqual({ binary: true, cut: false, lines: [] });
    const big = (await diff(app, { path: other, group: 'unstaged', file: 'big.txt' })).json() as { cut: boolean; lines: unknown[] };
    expect(big.cut).toBe(true);
    expect(big.lines).toHaveLength(5_000);
  });

  it.each([
    ['missing', { group: 'unstaged', file: 'a.txt' }],
    ['relative', { path: 'project', group: 'unstaged', file: 'a.txt' }],
  ])('answers 400 invalid_path when the path is %s', async (_name, query) => {
    const response = await diff(await routeWith(), query);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_path' });
  });

  it.each([
    ['missing', {}],
    ['another value', { group: 'both' }],
  ])('answers 400 invalid_group when the group is %s', async (_name, extra) => {
    const response = await diff(await routeWith(), { path: repo, file: 'a.txt', ...extra });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_group' });
  });

  it.each([
    ['file missing', {}],
    ['file empty', { file: '' }],
    ['file absolute', { file: '/etc/passwd' }],
    ['file out of the repository', { file: '../outside.txt' }],
    ['file with .. inside', { file: 'sub/../../outside.txt' }],
    ['oldPath absolute', { file: 'a.txt', oldPath: '/etc/passwd' }],
    ['oldPath out of the repository', { file: 'a.txt', oldPath: '../outside.txt' }],
  ])('answers 400 invalid_file when %s', async (_name, extra) => {
    const response = await diff(await routeWith(), { path: repo, group: 'unstaged', ...extra });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_file' });
  });

  // plan-git_explorer/REQ-6
  it('answers 500 git_error with the message of a git error', async () => {
    const response = await diff(await routeWith(failing), { path: repo, group: 'unstaged', file: 'other/code.ts' });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'git_error', message: 'fatal: bad object HEAD' });
  });

  // plan-git_explorer/REQ-8
  it('leaves the repository unchanged', async () => {
    const snapshot = async () => ({
      files: (await readdir(repo, { recursive: true })).sort(),
      index: statSync(path.join(repo, '.git', 'index')).mtimeMs,
      head: git(repo, 'rev-parse', 'HEAD'),
    });
    const before = await snapshot();
    const app = await routeWith();
    await changes(app, { path: repo });
    await diff(app, { path: repo, group: 'unstaged', file: 'other/code.ts' });
    await diff(app, { path: repo, group: 'staged', file: 'sub/new.txt' });
    await diff(app, { path: repo, group: 'unstaged', file: 'scratch.md' });
    expect(await snapshot()).toEqual(before);
  });
});
