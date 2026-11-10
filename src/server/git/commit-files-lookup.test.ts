// Unit tests of lookupCommitFiles and lookupCommitFileDiff (plan-git_explorer, batch history), on real git repositories.
import { mkdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { lookupCommitFileDiff } from './commit-diff-lookup.js';
import { lookupCommitFiles } from './commit-files-lookup.js';
import { git, repoWithCommit, tempFolder } from './git-fixtures.js';
import { GitError, GitRunner } from './git-runner.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1]);
const numbered = (count: number, prefix: string) => Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}\n`).join('');

let dir: string;
let repo: string;
/** First commit: adds sub/file.txt. */
let first: string;
/** Adds lib/a.txt, logo.png, old-name.txt, a[1].txt, a1.txt and link-me. */
let second: string;
/** Modifies lib/a.txt and logo.png, deletes sub/file.txt, renames old-name.txt, changes a[1].txt and a1.txt, turns link-me into a symlink. */
let third: string;
/** Merge of the branch "side" (adds side.txt) into main (which added main.txt). */
let merge: string;
/** Adds big.txt with 6,000 lines. */
let big: string;

beforeAll(async () => {
  dir = await tempFolder('ai-client-commit-files-');
  repo = await repoWithCommit(dir, 'project');
  first = git(repo, 'rev-parse', 'HEAD');

  await mkdir(path.join(repo, 'lib'));
  await writeFile(path.join(repo, 'lib', 'a.txt'), 'alpha\nbeta\ngamma\n');
  await writeFile(path.join(repo, 'logo.png'), PNG);
  await writeFile(path.join(repo, 'old-name.txt'), numbered(20, 'stable'));
  await writeFile(path.join(repo, 'a[1].txt'), 'bracket\n');
  await writeFile(path.join(repo, 'a1.txt'), 'plain\n');
  await writeFile(path.join(repo, 'link-me'), 'target.txt\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'second');
  second = git(repo, 'rev-parse', 'HEAD');

  await writeFile(path.join(repo, 'lib', 'a.txt'), 'alpha\nBETA\ngamma\n');
  await writeFile(path.join(repo, 'logo.png'), Buffer.concat([PNG, Buffer.from([0, 1, 2, 3])]));
  await rm(path.join(repo, 'sub'), { recursive: true });
  await rename(path.join(repo, 'old-name.txt'), path.join(repo, 'new-name.txt'));
  await writeFile(path.join(repo, 'a[1].txt'), 'bracket changed\n');
  await writeFile(path.join(repo, 'a1.txt'), 'plain changed\n');
  await rm(path.join(repo, 'link-me'));
  await symlink('target.txt', path.join(repo, 'link-me'));
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'third');
  third = git(repo, 'rev-parse', 'HEAD');

  git(repo, 'checkout', '-q', '-b', 'side');
  await writeFile(path.join(repo, 'side.txt'), 'side\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'side');
  git(repo, 'checkout', '-q', 'main');
  await writeFile(path.join(repo, 'main.txt'), 'main\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'main');
  git(repo, 'merge', '-q', '--no-ff', '-m', 'merge side', 'side');
  merge = git(repo, 'rev-parse', 'HEAD');

  await writeFile(path.join(repo, 'big.txt'), numbered(6_000, 'line'));
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'big');
  big = git(repo, 'rev-parse', 'HEAD');
}, 60_000);

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const byPath = <T extends { path: string }>(files: T[]) => [...files].sort((a, b) => (a.path < b.path ? -1 : 1));
const changedLines = (lines: Array<{ kind: string; text: string }>) => lines.filter((line) => line.kind === 'added' || line.kind === 'removed');

describe('lookupCommitFiles', () => {
  // plan-git_explorer/REQ-18, REQ-22: the first commit against the empty tree
  it('gives every file of a first commit as added', async () => {
    expect(await lookupCommitFiles(new GitRunner(), repo, first)).toEqual([{ kind: 'added', path: 'sub/file.txt', binary: false }]);
  });

  // plan-git_explorer/REQ-22
  it('gives added files with a binary mark for a binary file', async () => {
    expect(byPath(await lookupCommitFiles(new GitRunner(), repo, second))).toEqual([
      { kind: 'added', path: 'a1.txt', binary: false },
      { kind: 'added', path: 'a[1].txt', binary: false },
      { kind: 'added', path: 'lib/a.txt', binary: false },
      { kind: 'added', path: 'link-me', binary: false },
      { kind: 'added', path: 'logo.png', binary: true },
      { kind: 'added', path: 'old-name.txt', binary: false },
    ]);
  });

  // plan-git_explorer/REQ-18: modified, deleted, renamed and a type change, paths from the root of a subfolder
  it('gives each kind of change against the first parent, with paths from the repository root', async () => {
    expect(byPath(await lookupCommitFiles(new GitRunner(), path.join(repo, 'lib'), third))).toEqual([
      { kind: 'modified', path: 'a1.txt', binary: false },
      { kind: 'modified', path: 'a[1].txt', binary: false },
      { kind: 'modified', path: 'lib/a.txt', binary: false },
      { kind: 'modified', path: 'link-me', binary: false },
      { kind: 'modified', path: 'logo.png', binary: true },
      { kind: 'renamed', path: 'new-name.txt', oldPath: 'old-name.txt', binary: false },
      { kind: 'deleted', path: 'sub/file.txt', binary: false },
    ]);
  });

  it('gives the files of a merge commit against its first parent only', async () => {
    expect(await lookupCommitFiles(new GitRunner(), repo, merge)).toEqual([{ kind: 'added', path: 'side.txt', binary: false }]);
  });

  // plan-git_explorer/REQ-6
  it('rejects with a GitError for an unknown hash', async () => {
    await expect(lookupCommitFiles(new GitRunner(), repo, 'f'.repeat(40))).rejects.toBeInstanceOf(GitError);
  });
});

describe('lookupCommitFileDiff', () => {
  // plan-git_explorer/REQ-19
  it('gives the diff of a file against the first parent', async () => {
    const diff = await lookupCommitFileDiff(new GitRunner(), repo, { hash: third, file: 'lib/a.txt' });
    expect(diff.binary).toBe(false);
    expect(diff.cut).toBe(false);
    expect(changedLines(diff.lines)).toEqual([
      { kind: 'removed', text: 'beta' },
      { kind: 'added', text: 'BETA' },
    ]);
  });

  it('reads paths from the repository root when the folder is a subfolder', async () => {
    const diff = await lookupCommitFileDiff(new GitRunner(), path.join(repo, 'lib'), { hash: third, file: 'lib/a.txt' });
    expect(changedLines(diff.lines)).toHaveLength(2);
  });

  // plan-git_explorer/REQ-19: the first commit against the empty tree
  it('gives every line as added in a first commit', async () => {
    const diff = await lookupCommitFileDiff(new GitRunner(), repo, { hash: first, file: 'sub/file.txt' });
    expect(changedLines(diff.lines)).toEqual([{ kind: 'added', text: 'one' }]);
  });

  it('gives every line as removed for a deleted file', async () => {
    const diff = await lookupCommitFileDiff(new GitRunner(), repo, { hash: third, file: 'sub/file.txt' });
    expect(changedLines(diff.lines)).toEqual([{ kind: 'removed', text: 'one' }]);
  });

  it('gives no lines for a pure rename with its oldPath', async () => {
    const diff = await lookupCommitFileDiff(new GitRunner(), repo, { hash: third, file: 'new-name.txt', oldPath: 'old-name.txt' });
    expect(diff.binary).toBe(false);
    expect(changedLines(diff.lines)).toEqual([]);
  });

  it('gives no lines for a file the commit did not change', async () => {
    const diff = await lookupCommitFileDiff(new GitRunner(), repo, { hash: merge, file: 'lib/a.txt' });
    expect(diff.lines).toEqual([]);
  });

  // plan-git_explorer/REQ-22
  it('marks a binary file', async () => {
    const diff = await lookupCommitFileDiff(new GitRunner(), repo, { hash: third, file: 'logo.png' });
    expect(diff.binary).toBe(true);
    expect(diff.lines).toEqual([]);
  });

  it('takes a path with glob characters literally', async () => {
    const diff = await lookupCommitFileDiff(new GitRunner(), repo, { hash: third, file: 'a[1].txt' });
    expect(changedLines(diff.lines)).toEqual([
      { kind: 'removed', text: 'bracket' },
      { kind: 'added', text: 'bracket changed' },
    ]);
  });

  it('cuts a diff of more than 5,000 lines', async () => {
    const diff = await lookupCommitFileDiff(new GitRunner(), repo, { hash: big, file: 'big.txt' });
    expect(diff.cut).toBe(true);
    expect(diff.lines.length).toBeLessThanOrEqual(5_000);
    expect(diff.lines.length).toBeGreaterThan(4_000);
  });

  it('gives the first part of a diff over 5 MB, cut, with no error', async () => {
    const runner = new GitRunner();
    const capped: Pick<GitRunner, 'run' | 'runCapped'> = {
      run: (folder, args, options) => runner.run(folder, args, options),
      runCapped: async (folder, args, options) => {
        const result = await runner.runCapped(folder, args, options);
        return { output: result.output.split('\n').slice(0, 8).join('\n'), truncated: true };
      },
    };
    const diff = await lookupCommitFileDiff(capped, repo, { hash: big, file: 'big.txt' });
    expect(diff.cut).toBe(true);
    expect(changedLines(diff.lines).length).toBeGreaterThan(0);
  });

  it('rejects with a GitError for an unknown hash', async () => {
    await expect(lookupCommitFileDiff(new GitRunner(), repo, { hash: 'f'.repeat(40), file: 'lib/a.txt' })).rejects.toBeInstanceOf(GitError);
  });
});
