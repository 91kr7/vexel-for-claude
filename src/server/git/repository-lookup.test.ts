// Unit tests of lookupRepository (plan-git_explorer, batch explorer-access), on real git repositories.
import { existsSync, statSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { git, repoWithCommit, tempFolder } from './git-fixtures.js';
import { GitError, GitRunner, isReadCommand } from './git-runner.js';
import { lookupRepository } from './repository-lookup.js';

let dir: string;
let repo: string;

beforeAll(async () => {
  dir = await tempFolder('ai-client-repo-lookup-');
  repo = await repoWithCommit(dir, 'project');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const runner = new GitRunner();

describe('lookupRepository', () => {
  // plan-git_explorer/REQ-1, REQ-4
  it('gives the root and the branch of a repository root', async () => {
    expect(await lookupRepository(runner, repo)).toEqual({ status: 'repository', root: repo, branch: { kind: 'branch', name: 'main' } });
  });

  it('gives the repository root for a subfolder', async () => {
    expect(await lookupRepository(runner, path.join(repo, 'sub'))).toEqual({ status: 'repository', root: repo, branch: { kind: 'branch', name: 'main' } });
  });

  it('gives a branch name with a slash in full', async () => {
    const other = await repoWithCommit(dir, 'slashed', 'feature/explorer');
    expect(await lookupRepository(runner, other)).toEqual({ status: 'repository', root: other, branch: { kind: 'branch', name: 'feature/explorer' } });
  });

  // plan-git_explorer/REQ-4: detached HEAD -> the short hash
  it('gives detached and the short hash of HEAD on a detached HEAD', async () => {
    const detached = await repoWithCommit(dir, 'detached');
    git(detached, 'checkout', '-q', '--detach');
    const hash = git(detached, 'rev-parse', '--short', 'HEAD');
    expect(await lookupRepository(runner, detached)).toEqual({ status: 'repository', root: detached, branch: { kind: 'detached', hash } });
  });

  it('gives the unborn branch of a repository with no commits', async () => {
    const empty = path.join(dir, 'empty');
    await mkdir(empty);
    git(empty, 'init', '-q', '-b', 'trunk');
    expect(await lookupRepository(runner, empty)).toEqual({ status: 'repository', root: empty, branch: { kind: 'branch', name: 'trunk' } });
  });

  // plan-git_explorer/REQ-2
  it('gives none for a folder outside any repository', async () => {
    const plain = path.join(dir, 'plain');
    await mkdir(plain);
    expect(await lookupRepository(runner, plain)).toEqual({ status: 'none' });
  });

  it('gives none for a folder that does not exist', async () => {
    expect(await lookupRepository(runner, path.join(dir, 'gone'))).toEqual({ status: 'none' });
  });

  it('gives none for a path that is a file', async () => {
    const file = path.join(dir, 'a-file.txt');
    await writeFile(file, 'x');
    expect(await lookupRepository(runner, file)).toEqual({ status: 'none' });
  });

  it('gives none when git is not installed', async () => {
    expect(await lookupRepository(new GitRunner(path.join(dir, 'no-such-git')), repo)).toEqual({ status: 'none' });
  });

  // plan-git_explorer/REQ-6: any other git failure reaches the caller with git's message
  it('rejects with the GitError of any other git failure', async () => {
    const failing = { run: () => Promise.reject(new GitError('failed', 'fatal: bad object HEAD', 128)) };
    await expect(lookupRepository(failing, repo)).rejects.toMatchObject({ kind: 'failed', message: 'fatal: bad object HEAD' });
  });

  it('rejects with a timeout GitError', async () => {
    const slow = { run: () => Promise.reject(new GitError('timeout', 'git did not answer within 10 s.')) };
    await expect(lookupRepository(slow, repo)).rejects.toMatchObject({ kind: 'timeout' });
  });

  // plan-git_explorer/REQ-8: only rev-parse and the read form of symbolic-ref; the index is untouched
  it('runs only rev-parse and read-form symbolic-ref, and leaves the index untouched', async () => {
    const detached = await repoWithCommit(dir, 'watched');
    await writeFile(path.join(detached, 'sub', 'file.txt'), 'changed\n');
    const index = path.join(detached, '.git', 'index');
    const calls: string[][] = [];
    const recording = { run: (folder: string, args: readonly string[]) => (calls.push([...args]), runner.run(folder, args)) };
    await lookupRepository(recording, detached);
    git(detached, 'checkout', '-q', '--detach');
    const beforeDetached = statSync(index).mtimeMs;
    await lookupRepository(recording, detached);
    expect(calls.length).toBeGreaterThan(0);
    for (const args of calls) {
      expect(['rev-parse', 'symbolic-ref']).toContain(args[0]);
      expect(isReadCommand(args)).toBe(true);
    }
    expect(statSync(index).mtimeMs).toBe(beforeDetached);
    expect(existsSync(`${index}.lock`)).toBe(false);
  });
});
