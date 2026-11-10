// Unit tests of parseLog (plan-git_explorer, batch history).
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { git, repoWithCommit, tempFolder } from './git-fixtures.js';
import { LOG_FORMAT, parseLog } from './log-parser.js';

const HASH_A = 'a'.repeat(40);
const HASH_B = 'b'.repeat(40);
const record = (hash: string, message: string, author = 'Ada', date = '2026-11-10T15:25:02+01:00') =>
  [hash, hash.slice(0, 7), message, author, date].join('\0');

describe('parseLog', () => {
  it('gives an empty list for an empty output', () => {
    expect(parseLog('')).toEqual([]);
  });

  // plan-git_explorer/REQ-17
  it('reads hash, short hash, message, author and date of each commit, in output order', () => {
    const output = `${record(HASH_A, 'first line\n\nbody line\n\n')}\0${record(HASH_B, 'second\n', 'Bob', '2026-01-02T03:04:05Z')}\0`;
    expect(parseLog(output)).toEqual([
      { hash: HASH_A, shortHash: 'aaaaaaa', message: 'first line\n\nbody line', author: 'Ada', date: '2026-11-10T15:25:02+01:00' },
      { hash: HASH_B, shortHash: 'bbbbbbb', message: 'second', author: 'Bob', date: '2026-01-02T03:04:05Z' },
    ]);
  });

  it('drops an incomplete last record', () => {
    const output = `${record(HASH_A, 'whole')}\0${HASH_B}\0bbbbbbb\0cut`;
    expect(parseLog(output).map((commit) => commit.hash)).toEqual([HASH_A]);
  });
});

describe('parseLog on real git output', () => {
  let dir: string;
  let repo: string;

  beforeAll(async () => {
    dir = await tempFolder('ai-client-log-parser-');
    repo = await repoWithCommit(dir, 'project');
    await writeFile(path.join(repo, 'b.txt'), 'b\n');
    git(repo, 'add', '.');
    git(repo, '-c', 'user.name=Grace Hopper', 'commit', '-q', '-m', 'Subject line', '-m', 'Body paragraph\nsecond body line');
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  // plan-git_explorer/REQ-16, REQ-17
  it('reads the output of git log -z with LOG_FORMAT', () => {
    const output = git(repo, 'log', '-z', LOG_FORMAT);
    const commits = parseLog(output);
    expect(commits).toHaveLength(2);
    const [newest, oldest] = commits;
    expect(newest!.hash).toBe(git(repo, 'rev-parse', 'HEAD'));
    expect(newest!.shortHash).toBe(git(repo, 'rev-parse', '--short', 'HEAD'));
    expect(newest!.message).toBe('Subject line\n\nBody paragraph\nsecond body line');
    expect(newest!.author).toBe('Grace Hopper');
    expect(newest!.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)$/);
    expect(newest!.date).toBe(git(repo, 'log', '-1', '--format=%aI'));
    expect(oldest!.message).toBe('first');
  });
});
