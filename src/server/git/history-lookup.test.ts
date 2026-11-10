// Unit tests of lookupHistory (plan-git_explorer, batch history), on real git repositories.
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { git, repoWithCommit, tempFolder } from './git-fixtures.js';
import { GitError, GitRunner } from './git-runner.js';
import { HISTORY_PAGE_SIZE, lookupHistory } from './history-lookup.js';

let dir: string;
/** 205 commits: "first", then "commit 2" … "commit 205" (the newest). */
let long: string;

beforeAll(async () => {
  dir = await tempFolder('ai-client-history-lookup-');
  long = await repoWithCommit(dir, 'long');
  for (let i = 2; i <= 205; i++) git(long, 'commit', '-q', '--allow-empty', '-m', `commit ${i}`);
}, 60_000);

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const subjects = (commits: Array<{ message: string }>) => commits.map((commit) => commit.message);

describe('lookupHistory', () => {
  it('has a page size of 100', () => {
    expect(HISTORY_PAGE_SIZE).toBe(100);
  });

  // plan-git_explorer/REQ-16, REQ-21: newest first, first page of 100, more to come
  it('gives the newest 100 commits of HEAD first, and hasMore', async () => {
    const page = await lookupHistory(new GitRunner(), long);
    expect(page.commits).toHaveLength(100);
    expect(page.hasMore).toBe(true);
    expect(page.commits[0]!.message).toBe('commit 205');
    expect(page.commits[0]!.hash).toBe(git(long, 'rev-parse', 'HEAD'));
    expect(page.commits[99]!.message).toBe('commit 106');
  });

  // plan-git_explorer/REQ-21
  it('gives the page that starts at the offset, and no more after the last one', async () => {
    const second = await lookupHistory(new GitRunner(), long, 100);
    expect(subjects(second.commits)).toEqual(Array.from({ length: 100 }, (_, i) => `commit ${105 - i}`));
    expect(second.hasMore).toBe(true);
    const last = await lookupHistory(new GitRunner(), long, 200);
    expect(subjects(last.commits)).toEqual(['commit 5', 'commit 4', 'commit 3', 'commit 2', 'first']);
    expect(last.hasMore).toBe(false);
  });

  it('gives hasMore false when the history fits exactly in the page', async () => {
    const page = await lookupHistory(new GitRunner(), long, 105);
    expect(page.commits).toHaveLength(100);
    expect(page.hasMore).toBe(false);
  });

  it('gives an empty page for an offset past the last commit', async () => {
    expect(await lookupHistory(new GitRunner(), long, 500)).toEqual({ commits: [], hasMore: false });
  });

  // plan-git_explorer/REQ-20
  it('gives an empty page, not an error, for a repository with no commits', async () => {
    const empty = path.join(dir, 'empty');
    await mkdir(empty);
    git(empty, 'init', '-q', '-b', 'main');
    expect(await lookupHistory(new GitRunner(), empty)).toEqual({ commits: [], hasMore: false });
  });

  it('gives the commits reachable from a detached HEAD', async () => {
    const repo = await repoWithCommit(dir, 'detached');
    git(repo, 'commit', '-q', '--allow-empty', '-m', 'second');
    git(repo, 'checkout', '-q', '--detach', 'HEAD~1');
    const page = await lookupHistory(new GitRunner(), path.join(repo, 'sub'));
    expect(subjects(page.commits)).toEqual(['first']);
    expect(page.hasMore).toBe(false);
  });

  it('lists only the current branch', async () => {
    const repo = await repoWithCommit(dir, 'branches');
    git(repo, 'checkout', '-q', '-b', 'other');
    git(repo, 'commit', '-q', '--allow-empty', '-m', 'on other');
    git(repo, 'checkout', '-q', 'main');
    git(repo, 'commit', '-q', '--allow-empty', '-m', 'on main');
    expect(subjects((await lookupHistory(new GitRunner(), repo)).commits)).toEqual(['on main', 'first']);
  });

  // plan-git_explorer/REQ-6
  it('rejects with a GitError outside any repository', async () => {
    const plain = path.join(dir, 'plain');
    await mkdir(plain, { recursive: true });
    await expect(lookupHistory(new GitRunner(), plain)).rejects.toBeInstanceOf(GitError);
  });

  // plan-git_explorer/REQ-8
  it('runs only rev-parse and log', async () => {
    const real = new GitRunner();
    const commands: string[] = [];
    const recording = {
      run: (folder: string, args: readonly string[], options?: Parameters<GitRunner['run']>[2]) => {
        commands.push(args[0] ?? '');
        return real.run(folder, args, options);
      },
    } as Pick<GitRunner, 'run'>;
    await lookupHistory(recording as GitRunner, long, 100);
    expect(commands.length).toBeGreaterThan(0);
    expect(commands.every((command) => command === 'rev-parse' || command === 'log'), commands.join(' ')).toBe(true);
  });
});
