// REQ tests at the REST API of plan-git_explorer, batch explorer-access: GET /api/git/repository on real git repositories.
import { statSync } from 'node:fs';
import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { git, repoWithCommit, tempFolder } from './git-fixtures.js';
import { GitError, GitRunner } from './git-runner.js';
import { registerRepositoryRoute } from './repository-route.js';

let dir: string;
let repo: string;
const apps: FastifyInstance[] = [];

beforeAll(async () => {
  dir = await tempFolder('ai-client-repo-route-');
  repo = await repoWithCommit(dir, 'project');
});

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

type Runner = Pick<GitRunner, 'run'>;

async function routeWith(runner: Runner = new GitRunner()): Promise<FastifyInstance> {
  const app = Fastify();
  registerRepositoryRoute(app, runner);
  await app.ready();
  apps.push(app);
  return app;
}

const get = (app: FastifyInstance, folder?: string) =>
  app.inject({ method: 'GET', url: '/api/git/repository', query: folder === undefined ? {} : { path: folder } });

describe('GET /api/git/repository', () => {
  // plan-git_explorer/REQ-1, REQ-4
  it('answers 200 with the root and the branch of a folder in a repository', async () => {
    const response = await get(await routeWith(), repo);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'repository', root: repo, branch: { kind: 'branch', name: 'main' } });
  });

  it('answers with the repository root for a subfolder', async () => {
    const response = await get(await routeWith(), path.join(repo, 'sub'));
    expect(response.json()).toEqual({ status: 'repository', root: repo, branch: { kind: 'branch', name: 'main' } });
  });

  // plan-git_explorer/REQ-4: detached HEAD
  it('answers detached and the short hash on a detached HEAD', async () => {
    const detached = await repoWithCommit(dir, 'detached');
    git(detached, 'checkout', '-q', '--detach');
    const response = await get(await routeWith(), detached);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'repository', root: detached, branch: { kind: 'detached', hash: git(detached, 'rev-parse', '--short', 'HEAD') } });
  });

  // plan-git_explorer/REQ-2
  it('answers 200 { status: "none" } for a folder outside any repository', async () => {
    const plain = path.join(dir, 'plain');
    await mkdir(plain);
    const response = await get(await routeWith(), plain);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'none' });
  });

  it('answers 200 { status: "none" } for a folder that does not exist', async () => {
    const response = await get(await routeWith(), path.join(dir, 'gone'));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'none' });
  });

  it('answers 200 { status: "none" } when git is not installed', async () => {
    const response = await get(await routeWith(new GitRunner(path.join(dir, 'no-such-git'))), repo);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'none' });
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['relative', 'project/sub'],
  ])('answers 400 invalid_path when the path is %s', async (_name, folder) => {
    const response = await get(await routeWith(), folder);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_path' });
  });

  // plan-git_explorer/REQ-6: a git error answers 500 with git's message
  it('answers 500 git_error with the message of a git error', async () => {
    const failing: Runner = { run: () => Promise.reject(new GitError('failed', 'fatal: bad object HEAD', 128)) };
    const response = await get(await routeWith(failing), repo);
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'git_error', message: 'fatal: bad object HEAD' });
  });

  it('looks up the normalized path: no trailing slash, no . or ..', async () => {
    const folders: string[] = [];
    const real = new GitRunner();
    const recording: Runner = { run: (folder, args) => (folders.push(folder), real.run(folder, args)) };
    const response = await get(await routeWith(recording), `${repo}/sub/./../`);
    expect(response.json()).toEqual({ status: 'repository', root: repo, branch: { kind: 'branch', name: 'main' } });
    expect(new Set(folders)).toEqual(new Set([repo]));
  });

  // plan-git_explorer/REQ-8: the lookup changes nothing in the folder or in the repository
  it('leaves the repository unchanged', async () => {
    const watched = await repoWithCommit(dir, 'watched');
    const listing = async () => (await readdir(watched, { recursive: true })).sort();
    const before = { files: await listing(), index: statSync(path.join(watched, '.git', 'index')).mtimeMs, head: git(watched, 'rev-parse', 'HEAD') };
    await get(await routeWith(), watched);
    expect({ files: await listing(), index: statSync(path.join(watched, '.git', 'index')).mtimeMs, head: git(watched, 'rev-parse', 'HEAD') }).toEqual(before);
  });
});
