// Unit tests of lookupFileDiff (plan-git_explorer, batch uncommitted-changes) on real git repositories.
import { statSync } from 'node:fs';
import { chmod, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { lookupFileDiff } from './diff-lookup.js';
import type { DiffLine } from './diff-parser.js';
import { git, repoWithCommit, tempFolder } from './git-fixtures.js';
import { GitError, GitRunner } from './git-runner.js';

let dir: string;
const runner = new GitRunner();

beforeAll(async () => {
  dir = await tempFolder('ai-client-diff-lookup-');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** A repository whose `a.txt` holds "one\ntwo\nthree\n" in HEAD. */
async function repoWithText(name: string): Promise<string> {
  const repo = await repoWithCommit(dir, name);
  await writeFile(path.join(repo, 'a.txt'), 'one\ntwo\nthree\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'text');
  return repo;
}

const body = (lines: DiffLine[]) => lines.filter((line) => line.kind !== 'hunk');
const added = (...texts: string[]) => texts.map((text) => ({ kind: 'added', text }));
const numbered = (count: number) => Array.from({ length: count }, (_, i) => `line ${i + 1}\n`).join('');

describe('lookupFileDiff', () => {
  // plan-git_explorer/REQ-12: staged against HEAD, unstaged against the index
  it('gives the staged change against HEAD and the unstaged change against the index', async () => {
    const repo = await repoWithText('two-sides');
    await writeFile(path.join(repo, 'a.txt'), 'one\nTWO\nthree\n');
    git(repo, 'add', 'a.txt');
    await writeFile(path.join(repo, 'a.txt'), 'one\nTWO\nTHREE\n');

    const staged = await lookupFileDiff(runner, repo, { group: 'staged', file: 'a.txt' });
    expect(staged.binary).toBe(false);
    expect(staged.cut).toBe(false);
    expect(staged.lines[0]?.kind).toBe('hunk');
    expect(body(staged.lines)).toEqual([
      { kind: 'context', text: 'one' },
      { kind: 'removed', text: 'two' },
      { kind: 'added', text: 'TWO' },
      { kind: 'context', text: 'three' },
    ]);

    const unstaged = await lookupFileDiff(runner, repo, { group: 'unstaged', file: 'a.txt' });
    expect(body(unstaged.lines)).toEqual([
      { kind: 'context', text: 'one' },
      { kind: 'context', text: 'TWO' },
      { kind: 'removed', text: 'three' },
      { kind: 'added', text: 'THREE' },
    ]);
  });

  it('gives every line as added for a staged file in a repository with no commits', async () => {
    const repo = path.join(dir, 'unborn');
    await mkdir(repo);
    git(repo, 'init', '-q', '-b', 'main');
    await writeFile(path.join(repo, 'first.txt'), 'x\ny\n');
    git(repo, 'add', '.');
    expect(body((await lookupFileDiff(runner, repo, { group: 'staged', file: 'first.txt' })).lines)).toEqual(added('x', 'y'));
  });

  it('gives every line as added for an untracked file', async () => {
    const repo = await repoWithCommit(dir, 'untracked');
    await mkdir(path.join(repo, 'notes'));
    await writeFile(path.join(repo, 'notes', 'todo.md'), 'first\nsecond\n');
    const diff = await lookupFileDiff(runner, repo, { group: 'unstaged', file: 'notes/todo.md' });
    expect(diff.binary).toBe(false);
    expect(body(diff.lines)).toEqual(added('first', 'second'));
  });

  it('gives every line as removed for a deleted file', async () => {
    const repo = await repoWithText('deleted');
    await rm(path.join(repo, 'a.txt'));
    expect(body((await lookupFileDiff(runner, repo, { group: 'unstaged', file: 'a.txt' })).lines)).toEqual([
      { kind: 'removed', text: 'one' },
      { kind: 'removed', text: 'two' },
      { kind: 'removed', text: 'three' },
    ]);
  });

  it('takes the file path from the repository root when the folder is a subfolder', async () => {
    const repo = await repoWithText('from-sub');
    await writeFile(path.join(repo, 'a.txt'), 'one\ntwo\nthree\nfour\n');
    expect(body((await lookupFileDiff(runner, path.join(repo, 'sub'), { group: 'unstaged', file: 'a.txt' })).lines)).toContainEqual({ kind: 'added', text: 'four' });
  });

  it('gives no lines for a pure staged rename with its old path', async () => {
    const repo = await repoWithText('pure-rename');
    git(repo, 'mv', 'a.txt', 'b.txt');
    expect(await lookupFileDiff(runner, repo, { group: 'staged', file: 'b.txt', oldPath: 'a.txt' })).toEqual({ binary: false, cut: false, lines: [] });
  });

  it('gives only the changed lines of a staged rename with an edit', async () => {
    const repo = await repoWithCommit(dir, 'edit-rename');
    await writeFile(path.join(repo, 'long.txt'), numbered(20));
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'long');
    git(repo, 'mv', 'long.txt', 'renamed.txt');
    await writeFile(path.join(repo, 'renamed.txt'), numbered(20).replace('line 10\n', 'line ten\n'));
    git(repo, 'add', 'renamed.txt');
    const changed = body((await lookupFileDiff(runner, repo, { group: 'staged', file: 'renamed.txt', oldPath: 'long.txt' })).lines).filter((line) => line.kind !== 'context');
    expect(changed).toEqual([
      { kind: 'removed', text: 'line 10' },
      { kind: 'added', text: 'line ten' },
    ]);
  });

  // plan-git_explorer/REQ-14
  it('marks a changed binary file as binary', async () => {
    const repo = await repoWithCommit(dir, 'binary');
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, 0, 1, 2, 3]);
    await writeFile(path.join(repo, 'image.png'), png);
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'image');
    await writeFile(path.join(repo, 'image.png'), Buffer.concat([png, Buffer.from([0, 9, 8, 7])]));
    expect(await lookupFileDiff(runner, repo, { group: 'unstaged', file: 'image.png' })).toEqual({ binary: true, cut: false, lines: [] });
  });

  it('marks an untracked binary file as binary', async () => {
    const repo = await repoWithCommit(dir, 'binary-untracked');
    await writeFile(path.join(repo, 'blob.bin'), Buffer.from([0, 1, 2, 0, 255, 0]));
    expect(await lookupFileDiff(runner, repo, { group: 'unstaged', file: 'blob.bin' })).toEqual({ binary: true, cut: false, lines: [] });
  });

  // plan-git_explorer/REQ-15
  it('cuts a diff of 20,000 changed lines to its first 5,000 lines', async () => {
    const repo = await repoWithCommit(dir, 'large');
    await writeFile(path.join(repo, 'big.txt'), numbered(20_000));
    const diff = await lookupFileDiff(runner, repo, { group: 'unstaged', file: 'big.txt' });
    expect(diff.cut).toBe(true);
    expect(diff.lines).toHaveLength(5_000);
    expect(diff.lines[1]).toEqual({ kind: 'added', text: 'line 1' });
  });

  it('gives the first part of a diff over 5 MB, cut, with no error', async () => {
    const repo = await repoWithCommit(dir, 'huge');
    const longLine = 'x'.repeat(70_000);
    await writeFile(path.join(repo, 'huge.txt'), Array.from({ length: 100 }, () => `${longLine}\n`).join(''));
    const diff = await lookupFileDiff(runner, repo, { group: 'unstaged', file: 'huge.txt' });
    expect(diff.binary).toBe(false);
    expect(diff.cut).toBe(true);
    expect(diff.lines.length).toBeGreaterThan(1);
    expect(diff.lines.length).toBeLessThan(101);
    expect(diff.lines.filter((line) => line.kind === 'added').every((line) => line.text === longLine)).toBe(true);
  });

  it('takes the file name literally: a glob character matches only that name', async () => {
    const repo = await repoWithCommit(dir, 'glob');
    await writeFile(path.join(repo, 'a*.txt'), 'star\n');
    await writeFile(path.join(repo, 'ab.txt'), 'plain\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'globs');
    await writeFile(path.join(repo, 'a*.txt'), 'star changed\n');
    await writeFile(path.join(repo, 'ab.txt'), 'plain changed\n');
    expect(body((await lookupFileDiff(runner, repo, { group: 'unstaged', file: 'a*.txt' })).lines)).toEqual([
      { kind: 'removed', text: 'star' },
      { kind: 'added', text: 'star changed' },
    ]);
  });

  it('ignores the external diff tool, the text conversion and the colours of the git config', async () => {
    const repo = await repoWithText('config');
    const marker = path.join(dir, 'external-ran');
    const tool = path.join(dir, 'external-diff.sh');
    await writeFile(tool, `#!/bin/sh\ntouch '${marker}'\necho EXTERNAL\n`);
    await chmod(tool, 0o755);
    git(repo, 'config', 'diff.external', tool);
    git(repo, 'config', 'diff.upper.textconv', 'tr a-z A-Z');
    git(repo, 'config', 'color.ui', 'always');
    await writeFile(path.join(repo, '.gitattributes'), 'a.txt diff=upper\n');
    await writeFile(path.join(repo, 'a.txt'), 'one\ntwo\nthree\nfour\n');
    const diff = await lookupFileDiff(runner, repo, { group: 'unstaged', file: 'a.txt' });
    expect(body(diff.lines)).toEqual([
      { kind: 'context', text: 'one' },
      { kind: 'context', text: 'two' },
      { kind: 'context', text: 'three' },
      { kind: 'added', text: 'four' },
    ]);
    expect(diff.lines.some((line) => line.text.includes('\u001b'))).toBe(false);
    expect(statSync(marker, { throwIfNoEntry: false })).toBeUndefined();
  });

  it('rejects with a GitError for a folder outside any repository', async () => {
    const plain = path.join(dir, 'plain');
    await mkdir(plain);
    await expect(lookupFileDiff(runner, plain, { group: 'unstaged', file: 'a.txt' })).rejects.toBeInstanceOf(GitError);
  });

  // plan-git_explorer/REQ-8
  it('leaves the files, the index and HEAD unchanged', async () => {
    const repo = await repoWithText('watched');
    await writeFile(path.join(repo, 'a.txt'), 'changed\n');
    await writeFile(path.join(repo, 'new.txt'), 'n\n');
    const snapshot = async () => ({
      files: (await readdir(repo, { recursive: true })).sort(),
      index: statSync(path.join(repo, '.git', 'index')).mtimeMs,
      head: git(repo, 'rev-parse', 'HEAD'),
    });
    const before = await snapshot();
    await lookupFileDiff(runner, repo, { group: 'unstaged', file: 'a.txt' });
    await lookupFileDiff(runner, repo, { group: 'staged', file: 'a.txt' });
    await lookupFileDiff(runner, repo, { group: 'unstaged', file: 'new.txt' });
    expect(await snapshot()).toEqual(before);
  });
});
