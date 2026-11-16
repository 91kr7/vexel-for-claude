// REQ tests at the REST API of plan-git_explorer batch history, plan-git_graph batch graph-history and plan-multi_repo_workspace batch combined-history: GET /api/git/history, /api/git/commit-files and /api/git/commit-diff on real git repositories.
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { git, repoWithCommit, tempFolder } from './git-fixtures.js';
import { GitError, GitRunner } from './git-runner.js';
import { registerHistoryRoutes } from './history-route.js';

type Runner = Pick<GitRunner, 'run' | 'runCapped'>;

let dir: string;
/** Three commits: "first" (sub/file.txt), "second" (adds lib/code.ts), "third" (changes lib/code.ts, renames sub/file.txt). */
let repo: string;
let hashes: { first: string; second: string; third: string };
const apps: FastifyInstance[] = [];

beforeAll(async () => {
  dir = await tempFolder('ai-client-history-route-');
  repo = await repoWithCommit(dir, 'project');
  const first = git(repo, 'rev-parse', 'HEAD');
  await mkdir(path.join(repo, 'lib'));
  await writeFile(path.join(repo, 'lib', 'code.ts'), 'const a = 1;\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'second');
  const second = git(repo, 'rev-parse', 'HEAD');
  await writeFile(path.join(repo, 'lib', 'code.ts'), 'const a = 2;\n');
  git(repo, 'mv', 'sub/file.txt', 'sub/renamed.txt');
  git(repo, 'add', '.');
  git(repo, '-c', 'user.name=Ada Lovelace', 'commit', '-q', '-m', 'third subject', '-m', 'third body');
  hashes = { first, second, third: git(repo, 'rev-parse', 'HEAD') };
});

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function routeWith(runner: Runner = new GitRunner()): Promise<FastifyInstance> {
  const app = Fastify();
  registerHistoryRoutes(app, runner);
  await app.ready();
  apps.push(app);
  return app;
}

const get = (app: FastifyInstance, url: string, query: Record<string, string>) => app.inject({ method: 'GET', url, query });
const history = (app: FastifyInstance, query: Record<string, string>) => get(app, '/api/git/history', query);
const commitFiles = (app: FastifyInstance, query: Record<string, string>) => get(app, '/api/git/commit-files', query);
const commitDiff = (app: FastifyInstance, query: Record<string, string>) => get(app, '/api/git/commit-diff', query);
const failing: Runner = {
  run: () => Promise.reject(new GitError('failed', 'fatal: bad object HEAD', 128)),
  runCapped: () => Promise.reject(new GitError('failed', 'fatal: bad object HEAD', 128)),
};

describe('GET /api/git/history', () => {
  // plan-git_explorer/REQ-16, REQ-17
  it('answers 200 with the commits of the current branch, newest first, each with hash, short hash, message, author and date', async () => {
    const response = await history(await routeWith(), { path: path.join(repo, 'sub') });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { commits: Array<Record<string, string>>; hasMore: boolean };
    expect(body.hasMore).toBe(false);
    expect(body.commits.map((commit) => commit.hash)).toEqual([hashes.third, hashes.second, hashes.first]);
    const newest = body.commits[0]!;
    expect(newest.shortHash).toBe(git(repo, 'rev-parse', '--short', hashes.third));
    expect(newest.message).toBe('third subject\n\nthird body');
    expect(newest.author).toBe('Ada Lovelace');
    expect(newest.date).toBe(git(repo, 'log', '-1', '--format=%aI', hashes.third));
  });

  // plan-git_explorer/REQ-21
  it('answers the page that starts at the offset', async () => {
    const response = await history(await routeWith(), { path: repo, offset: '1' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { commits: Array<{ hash: string }>; hasMore: boolean };
    expect(body.commits.map((commit) => commit.hash)).toEqual([hashes.second, hashes.first]);
  });

  // plan-git_explorer/REQ-20, plan-git_graph/REQ-17
  it('answers 200 with an empty page for a repository with no commits', async () => {
    const empty = path.join(dir, 'empty');
    await mkdir(empty, { recursive: true });
    git(empty, 'init', '-q', '-b', 'main');
    const response = await history(await routeWith(), { path: empty });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ commits: [], hasMore: false });
  });

  it.each([
    ['missing', {}],
    ['empty', { path: '' }],
    ['relative', { path: 'project' }],
  ])('answers 400 invalid_path when the path is %s', async (_name, query) => {
    const response = await history(await routeWith(), query);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_path' });
  });

  it.each(['-1', '1.5', 'abc', ''])('answers 400 invalid_offset for the offset %j', async (offset) => {
    const response = await history(await routeWith(), { path: repo, offset });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_offset' });
  });

  // plan-git_explorer/REQ-6
  it('answers 500 git_error for a folder outside any repository', async () => {
    const plain = path.join(dir, 'plain');
    await mkdir(plain, { recursive: true });
    const response = await history(await routeWith(), { path: plain });
    expect(response.statusCode).toBe(500);
    const body = response.json() as { error: string; message: string };
    expect(body.error).toBe('git_error');
    expect(body.message).toMatch(/not a git repository/i);
  });

  it('answers 500 git_error with the message of a git error', async () => {
    const response = await history(await routeWith(failing), { path: repo });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'git_error', message: 'fatal: bad object HEAD' });
  });
});

describe('GET /api/git/commit-files', () => {
  // plan-git_explorer/REQ-18
  it('answers 200 with the files of the commit and their kind', async () => {
    const response = await commitFiles(await routeWith(), { path: path.join(repo, 'sub'), hash: hashes.third });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { files: Array<{ path: string }> };
    expect([...body.files].sort((a, b) => a.path.localeCompare(b.path))).toEqual([
      { kind: 'modified', path: 'lib/code.ts', binary: false },
      { kind: 'renamed', path: 'sub/renamed.txt', oldPath: 'sub/file.txt', binary: false },
    ]);
  });

  it.each([
    ['missing', {}],
    ['relative', { path: 'project' }],
  ])('answers 400 invalid_path when the path is %s', async (_name, query) => {
    const response = await commitFiles(await routeWith(), { ...query, hash: 'a'.repeat(40) });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_path' });
  });

  it.each([
    ['missing', undefined],
    ['short', 'abc1234'],
    ['upper case', 'A'.repeat(40)],
    ['not hex', 'g'.repeat(40)],
    ['41 digits', 'a'.repeat(41)],
    ['a revision name', 'HEAD'],
  ])('answers 400 invalid_hash when the hash is %s', async (_name, hash) => {
    const response = await commitFiles(await routeWith(), hash === undefined ? { path: repo } : { path: repo, hash });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_hash' });
  });

  it('accepts a 64-digit hash and answers 500 git_error for an unknown commit', async () => {
    const response = await commitFiles(await routeWith(), { path: repo, hash: 'b'.repeat(64) });
    expect(response.statusCode).toBe(500);
    expect((response.json() as { error: string }).error).toBe('git_error');
  });

  // plan-git_explorer/REQ-6
  it('answers 500 git_error with a message for an unknown commit', async () => {
    const response = await commitFiles(await routeWith(), { path: repo, hash: 'f'.repeat(40) });
    expect(response.statusCode).toBe(500);
    const body = response.json() as { error: string; message: string };
    expect(body.error).toBe('git_error');
    expect(body.message.length).toBeGreaterThan(0);
  });
});

describe('GET /api/git/commit-diff', () => {
  // plan-git_explorer/REQ-19
  it('answers 200 with the diff of the file in that commit', async () => {
    const response = await commitDiff(await routeWith(), { path: repo, hash: hashes.third, file: 'lib/code.ts' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { binary: boolean; cut: boolean; lines: Array<{ kind: string; text: string }> };
    expect(body.binary).toBe(false);
    expect(body.cut).toBe(false);
    expect(body.lines.filter((line) => line.kind === 'added' || line.kind === 'removed')).toEqual([
      { kind: 'removed', text: 'const a = 1;' },
      { kind: 'added', text: 'const a = 2;' },
    ]);
  });

  it('answers 200 with the rename diff when oldPath is given', async () => {
    const response = await commitDiff(await routeWith(), { path: repo, hash: hashes.third, file: 'sub/renamed.txt', oldPath: 'sub/file.txt' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { lines: Array<{ kind: string }> };
    expect(body.lines.filter((line) => line.kind === 'added' || line.kind === 'removed')).toEqual([]);
  });

  it('answers 400 invalid_path and invalid_hash', async () => {
    const app = await routeWith();
    const noPath = await commitDiff(app, { path: 'project', hash: hashes.third, file: 'lib/code.ts' });
    expect(noPath.statusCode).toBe(400);
    expect(noPath.json()).toEqual({ error: 'invalid_path' });
    const noHash = await commitDiff(app, { path: repo, hash: 'HEAD', file: 'lib/code.ts' });
    expect(noHash.statusCode).toBe(400);
    expect(noHash.json()).toEqual({ error: 'invalid_hash' });
  });

  it.each([
    ['file missing', {}],
    ['file empty', { file: '' }],
    ['file absolute', { file: '/etc/passwd' }],
    ['file out of the repository', { file: '../outside.txt' }],
    ['file out of the repository through a subfolder', { file: 'lib/../../outside.txt' }],
    ['oldPath empty', { file: 'lib/code.ts', oldPath: '' }],
    ['oldPath absolute', { file: 'lib/code.ts', oldPath: '/etc/passwd' }],
    ['oldPath out of the repository', { file: 'lib/code.ts', oldPath: '../outside.txt' }],
  ])('answers 400 invalid_file with %s', async (_name, query) => {
    const response = await commitDiff(await routeWith(), { path: repo, hash: hashes.third, ...query });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_file' });
  });

  // plan-git_explorer/REQ-6
  it('answers 500 git_error with the message of a git error', async () => {
    const response = await commitDiff(await routeWith(failing), { path: repo, hash: hashes.third, file: 'lib/code.ts' });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'git_error', message: 'fatal: bad object HEAD' });
  });
});

/** Every entry of a folder tree with its size and modification time. */
async function snapshot(folder: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const name of await readdir(folder, { recursive: true })) {
    const info = await stat(path.join(folder, name));
    result[name] = `${info.size}:${info.mtimeMs}`;
  }
  return result;
}

describe('read only', () => {
  // plan-git_explorer/REQ-8
  it('the three routes change nothing in the repository or in the files of the folder', async () => {
    await writeFile(path.join(repo, 'lib', 'code.ts'), 'const a = 3;\n');
    git(repo, 'add', 'lib/code.ts');
    await writeFile(path.join(repo, 'untracked.txt'), 'new\n');
    const status = git(repo, 'status', '--porcelain=v2');
    const before = await snapshot(repo);

    const app = await routeWith();
    expect((await history(app, { path: repo })).statusCode).toBe(200);
    expect((await commitFiles(app, { path: repo, hash: hashes.third })).statusCode).toBe(200);
    expect((await commitDiff(app, { path: repo, hash: hashes.third, file: 'lib/code.ts' })).statusCode).toBe(200);

    expect(await snapshot(repo)).toEqual(before);
    expect(git(repo, 'status', '--porcelain=v2')).toBe(status);
  });
});

/** A git commit with fixed author and committer dates. */
function commitAt(folder: string, date: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], {
    cwd: folder,
    env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
  });
}

describe('graph history (plan-git_graph)', () => {
  /** main: first, main work, Merge feature; feature (from first): feature one (dated before first), feature two. */
  let merged: string;
  let ids: { first: string; featureOne: string; featureTwo: string; mainWork: string; merge: string };

  beforeAll(async () => {
    merged = path.join(dir, 'merged');
    await mkdir(path.join(merged, 'sub'), { recursive: true });
    git(merged, 'init', '-q', '-b', 'main');
    await writeFile(path.join(merged, 'sub', 'file.txt'), 'one\n');
    git(merged, 'add', '.');
    commitAt(merged, '2026-01-10T10:00:00Z', 'commit', '-q', '-m', 'first');
    const first = git(merged, 'rev-parse', 'HEAD');
    git(merged, 'checkout', '-q', '-b', 'feature');
    await writeFile(path.join(merged, 'feature.txt'), 'alpha\n');
    await writeFile(path.join(merged, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 0, 255]));
    git(merged, 'add', '.');
    commitAt(merged, '2026-01-05T10:00:00Z', 'commit', '-q', '-m', 'feature one');
    const featureOne = git(merged, 'rev-parse', 'HEAD');
    await writeFile(path.join(merged, 'feature.txt'), 'alpha\nbeta\n');
    commitAt(merged, '2026-01-12T10:00:00Z', 'commit', '-q', '-a', '-m', 'feature two');
    const featureTwo = git(merged, 'rev-parse', 'HEAD');
    git(merged, 'checkout', '-q', 'main');
    await writeFile(path.join(merged, 'sub', 'file.txt'), 'two\n');
    commitAt(merged, '2026-01-11T10:00:00Z', 'commit', '-q', '-a', '-m', 'main work');
    const mainWork = git(merged, 'rev-parse', 'HEAD');
    commitAt(merged, '2026-01-13T10:00:00Z', 'merge', '-q', '--no-ff', '-m', 'Merge feature', 'feature');
    ids = { first, featureOne, featureTwo, mainWork, merge: git(merged, 'rev-parse', 'HEAD') };
  });

  type Listed = { hash: string; parents: string[] };
  const listed = async () => {
    const response = await history(await routeWith(), { path: merged });
    expect(response.statusCode).toBe(200);
    return (response.json() as { commits: Listed[] }).commits;
  };

  // plan-git_graph/REQ-8, REQ-9
  it('lists the merged commits too, in date order, a commit never after one of its parents', async () => {
    const commits = await listed();
    expect(commits.map((commit) => commit.hash)).toEqual([ids.merge, ids.featureTwo, ids.mainWork, ids.featureOne, ids.first]);
    const position = new Map(commits.map((commit, index) => [commit.hash, index]));
    for (const [index, commit] of commits.entries()) for (const parent of commit.parents) expect(position.get(parent)!).toBeGreaterThan(index);
  });

  // plan-git_graph/REQ-10
  it('gives each commit its parents: two for the merge, first parent first, none for the root', async () => {
    const byHash = new Map((await listed()).map((commit) => [commit.hash, commit.parents]));
    expect(byHash.get(ids.merge)).toEqual([ids.mainWork, ids.featureTwo]);
    expect(byHash.get(ids.featureTwo)).toEqual([ids.featureOne]);
    expect(byHash.get(ids.first)).toEqual([]);
  });

  // plan-git_graph/REQ-14, REQ-16: the files of a merge against its first parent, a binary file included
  it('answers the files of the merge commit against its first parent', async () => {
    const response = await commitFiles(await routeWith(), { path: merged, hash: ids.merge });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { files: Array<{ path: string }> };
    expect([...body.files].sort((a, b) => a.path.localeCompare(b.path))).toEqual([
      { kind: 'added', path: 'feature.txt', binary: false },
      { kind: 'added', path: 'logo.png', binary: true },
    ]);
  });

  // plan-git_graph/REQ-15, REQ-16
  it('answers the diff of a file of the merge commit against its first parent, and a binary mark for a binary file', async () => {
    const app = await routeWith();
    const text = await commitDiff(app, { path: merged, hash: ids.merge, file: 'feature.txt' });
    expect(text.statusCode).toBe(200);
    const lines = (text.json() as { lines: Array<{ kind: string; text: string }> }).lines;
    expect(lines.filter((line) => line.kind === 'added' || line.kind === 'removed')).toEqual([
      { kind: 'added', text: 'alpha' },
      { kind: 'added', text: 'beta' },
    ]);
    const binary = await commitDiff(app, { path: merged, hash: ids.merge, file: 'logo.png' });
    expect(binary.statusCode).toBe(200);
    expect((binary.json() as { binary: boolean }).binary).toBe(true);
  });
});

describe('committer date (plan-multi_repo_workspace)', () => {
  // plan-multi_repo_workspace/REQ-21: the combined history orders by committer date, so the route gives it
  it('answers each commit with its committer date apart from its author date', async () => {
    const dated = path.join(dir, 'dated');
    await mkdir(dated, { recursive: true });
    git(dated, 'init', '-q', '-b', 'main');
    execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '-q', '--allow-empty', '-m', 'rebased'], {
      cwd: dated,
      env: { ...process.env, GIT_AUTHOR_DATE: '2020-01-02T03:04:05+00:00', GIT_COMMITTER_DATE: '2024-06-07T08:09:10+00:00' },
    });
    const response = await history(await routeWith(), { path: dated });
    expect(response.statusCode).toBe(200);
    const [commit] = (response.json() as { commits: Array<Record<string, string>> }).commits;
    expect(Date.parse(commit!.date!)).toBe(Date.parse('2020-01-02T03:04:05Z'));
    expect(Date.parse(commit!.committerDate!)).toBe(Date.parse('2024-06-07T08:09:10Z'));
    expect(commit!.committerDate).toBe(git(dated, 'log', '-1', '--format=%cI'));
  });
});
