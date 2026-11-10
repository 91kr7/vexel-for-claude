// Unit tests of lookupChanges and repositoryRootOf (plan-git_explorer, batch uncommitted-changes) on real git repositories.
import { statSync } from 'node:fs';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { lookupChanges, repositoryRootOf } from './changes-lookup.js';
import { git, repoWithCommit, tempFolder } from './git-fixtures.js';
import { GitError, GitRunner } from './git-runner.js';

let dir: string;
const runner = new GitRunner();

beforeAll(async () => {
  dir = await tempFolder('ai-client-changes-lookup-');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const sortEntries = <T extends { group: string; path: string }>(entries: T[]) =>
  [...entries].sort((a, b) => `${a.group}:${a.path}`.localeCompare(`${b.group}:${b.path}`));

describe('lookupChanges', () => {
  it('gives no entry for a clean repository', async () => {
    const repo = await repoWithCommit(dir, 'clean');
    expect(await lookupChanges(runner, repo)).toEqual([]);
  });

  // plan-git_explorer/REQ-5, REQ-9: the whole repository, also outside the folder, paths from the root
  it('lists every change of the repository from a subfolder, with paths from the root', async () => {
    const repo = await repoWithCommit(dir, 'whole');
    await mkdir(path.join(repo, 'other'));
    await writeFile(path.join(repo, 'other', 'tracked.txt'), 'a\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'second');
    await writeFile(path.join(repo, 'sub', 'staged-new.txt'), 'new\n');
    git(repo, 'add', 'sub/staged-new.txt');
    await writeFile(path.join(repo, 'other', 'tracked.txt'), 'b\n');
    await writeFile(path.join(repo, 'root-untracked.txt'), 'u\n');

    expect(sortEntries(await lookupChanges(runner, path.join(repo, 'sub')))).toEqual([
      { group: 'staged', kind: 'added', path: 'sub/staged-new.txt' },
      { group: 'unstaged', kind: 'modified', path: 'other/tracked.txt' },
      { group: 'unstaged', kind: 'untracked', path: 'root-untracked.txt' },
    ]);
  });

  it('lists each untracked file of an untracked folder one by one', async () => {
    const repo = await repoWithCommit(dir, 'untracked-folder');
    await mkdir(path.join(repo, 'fresh', 'deep'), { recursive: true });
    await writeFile(path.join(repo, 'fresh', 'a.txt'), 'a\n');
    await writeFile(path.join(repo, 'fresh', 'deep', 'b.txt'), 'b\n');
    expect(sortEntries(await lookupChanges(runner, repo))).toEqual([
      { group: 'unstaged', kind: 'untracked', path: 'fresh/a.txt' },
      { group: 'unstaged', kind: 'untracked', path: 'fresh/deep/b.txt' },
    ]);
  });

  // plan-git_explorer/REQ-10: renamed and deleted kinds
  it('detects a staged rename with its old path, and a deleted file', async () => {
    const repo = await repoWithCommit(dir, 'rename');
    await writeFile(path.join(repo, 'gone.txt'), 'bye\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'second');
    git(repo, 'mv', 'sub/file.txt', 'sub/moved file.txt');
    await rm(path.join(repo, 'gone.txt'));
    expect(sortEntries(await lookupChanges(runner, repo))).toEqual([
      { group: 'staged', kind: 'renamed', path: 'sub/moved file.txt', oldPath: 'sub/file.txt' },
      { group: 'unstaged', kind: 'deleted', path: 'gone.txt' },
    ]);
  });

  // plan-git_explorer/REQ-11
  it('lists a file with staged and unstaged changes in both groups', async () => {
    const repo = await repoWithCommit(dir, 'both');
    await writeFile(path.join(repo, 'sub', 'file.txt'), 'two\n');
    git(repo, 'add', '.');
    await writeFile(path.join(repo, 'sub', 'file.txt'), 'three\n');
    expect(sortEntries(await lookupChanges(runner, repo))).toEqual([
      { group: 'staged', kind: 'modified', path: 'sub/file.txt' },
      { group: 'unstaged', kind: 'modified', path: 'sub/file.txt' },
    ]);
  });

  it('lists the staged files of a repository with no commits', async () => {
    const repo = path.join(dir, 'unborn');
    await mkdir(repo);
    git(repo, 'init', '-q', '-b', 'main');
    await writeFile(path.join(repo, 'first.txt'), 'x\n');
    git(repo, 'add', '.');
    expect(await lookupChanges(runner, repo)).toEqual([{ group: 'staged', kind: 'added', path: 'first.txt' }]);
  });

  it('rejects with a GitError for a folder outside any repository', async () => {
    const plain = path.join(dir, 'plain');
    await mkdir(plain);
    await expect(lookupChanges(runner, plain)).rejects.toBeInstanceOf(GitError);
  });

  // plan-git_explorer/REQ-8
  it('leaves the files, the index and HEAD unchanged', async () => {
    const repo = await repoWithCommit(dir, 'watched');
    await writeFile(path.join(repo, 'sub', 'file.txt'), 'changed\n');
    await writeFile(path.join(repo, 'new.txt'), 'n\n');
    const snapshot = async () => ({
      files: (await readdir(repo, { recursive: true })).sort(),
      index: statSync(path.join(repo, '.git', 'index')).mtimeMs,
      head: git(repo, 'rev-parse', 'HEAD'),
    });
    const before = await snapshot();
    await lookupChanges(runner, repo);
    expect(await snapshot()).toEqual(before);
  });
});

describe('repositoryRootOf', () => {
  it('gives the absolute root of the working tree from a subfolder', async () => {
    const repo = await repoWithCommit(dir, 'root-of');
    expect(await repositoryRootOf(runner, path.join(repo, 'sub'))).toBe(repo);
  });
});
