// Unit tests of parseLog (plan-git_explorer batch history, plan-git_graph batch graph-history, plan-multi_repo_workspace batch combined-history).
import { execFileSync } from 'node:child_process';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { git, repoWithCommit, tempFolder } from './git-fixtures.js';
import { LOG_FORMAT, parseLog } from './log-parser.js';

const HASH_A = 'a'.repeat(40);
const HASH_B = 'b'.repeat(40);
const HASH_C = 'c'.repeat(40);
const record = (
  hash: string,
  message: string,
  author = 'Ada',
  date = '2026-11-10T15:25:02+01:00',
  parents: string[] = [],
  committerDate = '2026-11-11T09:00:00+01:00',
) => [hash, hash.slice(0, 7), parents.join(' '), message, author, date, committerDate].join('\0');

describe('parseLog', () => {
  it('gives an empty list for an empty output', () => {
    expect(parseLog('')).toEqual([]);
  });

  // plan-git_explorer/REQ-17
  it('reads hash, short hash, message, author and date of each commit, in output order', () => {
    const output = `${record(HASH_A, 'first line\n\nbody line\n\n', 'Ada', undefined, [HASH_B])}\0${record(HASH_B, 'second\n', 'Bob', '2026-01-02T03:04:05Z')}\0`;
    expect(parseLog(output)).toEqual([
      {
        hash: HASH_A,
        shortHash: 'aaaaaaa',
        parents: [HASH_B],
        message: 'first line\n\nbody line',
        author: 'Ada',
        date: '2026-11-10T15:25:02+01:00',
        committerDate: '2026-11-11T09:00:00+01:00',
      },
      {
        hash: HASH_B,
        shortHash: 'bbbbbbb',
        parents: [],
        message: 'second',
        author: 'Bob',
        date: '2026-01-02T03:04:05Z',
        committerDate: '2026-11-11T09:00:00+01:00',
      },
    ]);
  });

  // plan-git_graph/REQ-10
  it('reads the parents of a merge in git order, first parent first', () => {
    const output = `${record(HASH_A, 'Merge', 'Ada', undefined, [HASH_C, HASH_B])}\0`;
    expect(parseLog(output)[0]!.parents).toEqual([HASH_C, HASH_B]);
  });

  // plan-multi_repo_workspace/REQ-21
  it('reads the committer date apart from the author date', () => {
    const output = `${record(HASH_A, 'm', 'Ada', '2026-01-01T10:00:00Z', [], '2026-03-04T05:06:07+02:00')}\0`;
    expect(parseLog(output)[0]).toMatchObject({ date: '2026-01-01T10:00:00Z', committerDate: '2026-03-04T05:06:07+02:00' });
  });

  it('drops an incomplete last record', () => {
    const output = `${record(HASH_A, 'whole')}\0${HASH_B}\0bbbbbbb\0\0cut\0Bob\0${'2026-01-01T10:00:00Z'}`;
    expect(parseLog(output).map((commit) => commit.hash)).toEqual([HASH_A]);
  });
});

const execGit = (folder: string, args: string[], env: Record<string, string>) =>
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], {
    cwd: folder,
    env: { ...process.env, ...env },
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
    expect(newest!.committerDate).toBe(git(repo, 'log', '-1', '--format=%cI'));
    expect(oldest!.message).toBe('first');
    expect(newest!.parents).toEqual([oldest!.hash]);
    expect(oldest!.parents, 'a root commit has no parents').toEqual([]);
  });

  // plan-multi_repo_workspace/REQ-21
  it('reads a committer date that differs from the author date', () => {
    execGit(repo, ['commit', '-q', '--allow-empty', '-m', 'dated'], {
      GIT_AUTHOR_DATE: '2020-01-02T03:04:05+00:00',
      GIT_COMMITTER_DATE: '2024-06-07T08:09:10+00:00',
    });
    const [newest] = parseLog(git(repo, 'log', '-z', LOG_FORMAT));
    expect(newest!.message).toBe('dated');
    expect(Date.parse(newest!.date)).toBe(Date.parse('2020-01-02T03:04:05Z'));
    expect(Date.parse(newest!.committerDate)).toBe(Date.parse('2024-06-07T08:09:10Z'));
    git(repo, 'reset', '-q', '--hard', 'HEAD~1');
  });

  // plan-git_graph/REQ-9, REQ-10
  it('reads both parents of a real merge commit', () => {
    const main = git(repo, 'rev-parse', 'HEAD');
    git(repo, 'checkout', '-q', '-b', 'side', 'HEAD~1');
    git(repo, 'commit', '-q', '--allow-empty', '-m', 'on side');
    const side = git(repo, 'rev-parse', 'HEAD');
    git(repo, 'checkout', '-q', 'main');
    git(repo, 'merge', '-q', '--no-ff', '-m', 'Merge side', 'side');
    const [merge, ...rest] = parseLog(git(repo, 'log', '-z', LOG_FORMAT));
    expect(merge!.message).toBe('Merge side');
    expect(merge!.parents).toEqual([main, side]);
    expect(rest.map((commit) => commit.hash)).toContain(side);
  });
});
