// Unit tests of GitRunner (plan-git_explorer, batches explorer-access and uncommitted-changes). Fake git programs are shell scripts in a temp folder.
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GitCommandRejected, GitError, GitRunner, isReadCommand } from './git-runner.js';

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'ai-client-git-runner-'));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

let scripts = 0;
async function fakeGit(body: string): Promise<string> {
  const file = path.join(dir, `fake-git-${++scripts}`);
  await writeFile(file, `#!/bin/sh\n${body}\n`);
  await chmod(file, 0o755);
  return file;
}

async function gitErrorOf(promise: Promise<unknown>): Promise<GitError> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(GitError);
  return error as GitError;
}

describe('isReadCommand', () => {
  it.each([
    [['rev-parse', '--show-toplevel']],
    [['rev-parse', '--short', 'HEAD']],
    [['symbolic-ref', 'HEAD']],
    [['symbolic-ref', '--short', '-q', 'HEAD']],
    [['status']],
    [['status', '--porcelain=v2', '-z', '--untracked-files=all']],
    [['diff', '--cached', '--', 'a.txt']],
    [['ls-files', '--error-unmatch', '--', 'a.txt']],
  ])('accepts the read command %j', (args) => {
    expect(isReadCommand(args)).toBe(true);
  });

  it.each([
    [[]],
    [['commit', '-m', 'x']],
    [['checkout', 'main']],
    [['symbolic-ref', 'HEAD', 'refs/heads/other']],
    [['symbolic-ref', '-d', 'HEAD']],
    [['symbolic-ref', '--delete', 'HEAD']],
    [['rev-parse', '--output=/tmp/x']],
    [['rev-parse', '--output', '/tmp/x']],
    [['diff', '--output=/tmp/x']],
    [['diff', 'HEAD', '--output', '/tmp/x']],
    [['add', 'a.txt']],
    [['stash']],
  ])('refuses %j', (args) => {
    expect(isReadCommand(args)).toBe(false);
  });
});

describe('GitRunner.run', () => {
  // plan-git_explorer/REQ-8: a command off the list never reaches git
  it('rejects a write command with GitCommandRejected and does not start git', async () => {
    const log = path.join(dir, 'rejected.log');
    const git = await fakeGit(`echo ran > '${log}'`);
    await expect(new GitRunner(git).run(dir, ['commit', '-m', 'x'])).rejects.toBeInstanceOf(GitCommandRejected);
    await expect(new GitRunner(git).run(dir, ['rev-parse', '--output=x'])).rejects.toBeInstanceOf(GitCommandRejected);
    expect(existsSync(log)).toBe(false);
  });

  // plan-git_explorer/REQ-8: --no-optional-locks first, a clean git environment, the folder as working folder
  it('runs git with --no-optional-locks in the folder, with the fixed environment and no server GIT_* variable', async () => {
    const log = path.join(dir, 'env.log');
    const git = await fakeGit(`{ echo "ARGS:$*"; echo "PWD:$(pwd)"; env; } > '${log}'; echo out`);
    const saved = { GIT_DIR: process.env.GIT_DIR, GIT_WORK_TREE: process.env.GIT_WORK_TREE };
    process.env.GIT_DIR = '/server/git-dir';
    process.env.GIT_WORK_TREE = '/server/work-tree';
    let stdout: string;
    try {
      stdout = await new GitRunner(git).run(dir, ['rev-parse', '--show-toplevel']);
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
    expect(stdout).toBe('out\n');
    const lines = (await readFile(log, 'utf8')).split('\n');
    expect(lines).toContain('ARGS:--no-optional-locks rev-parse --show-toplevel');
    expect(lines).toContain(`PWD:${dir}`);
    expect(lines).toContain('GIT_OPTIONAL_LOCKS=0');
    expect(lines).toContain('LC_ALL=C');
    expect(lines).toContain('GIT_TERMINAL_PROMPT=0');
    const gitVariables = lines.filter((line) => line.startsWith('GIT_')).map((line) => line.split('=')[0]);
    expect(gitVariables.sort()).toEqual(['GIT_OPTIONAL_LOCKS', 'GIT_TERMINAL_PROMPT']);
  });

  // plan-git_explorer/REQ-2: git that cannot start, in an existing folder
  it('rejects with not_installed when the git program cannot be started', async () => {
    const error = await gitErrorOf(new GitRunner(path.join(dir, 'no-such-git')).run(dir, ['rev-parse', '--show-toplevel']));
    expect(error.kind).toBe('not_installed');
    expect(error.message).toBe('git is not installed.');
  });

  it('rejects with folder_not_found when the folder does not exist', async () => {
    const missing = path.join(dir, 'missing');
    const error = await gitErrorOf(new GitRunner().run(missing, ['rev-parse', '--show-toplevel']));
    expect(error.kind).toBe('folder_not_found');
    expect(error.message).toBe('The folder does not exist.');
  });

  it('rejects with folder_not_found, not not_installed, when both the folder and git are missing', async () => {
    const error = await gitErrorOf(new GitRunner(path.join(dir, 'no-such-git')).run(path.join(dir, 'missing'), ['rev-parse', 'HEAD']));
    expect(error.kind).toBe('folder_not_found');
  });

  // plan-git_explorer/REQ-6: git's own message reaches the caller
  it('rejects with failed, git error output trimmed and the exit code', async () => {
    const git = await fakeGit(`echo '  fatal: something broke  ' >&2; exit 3`);
    const error = await gitErrorOf(new GitRunner(git).run(dir, ['rev-parse', 'HEAD']));
    expect(error.kind).toBe('failed');
    expect(error.message).toBe('fatal: something broke');
    expect(error.exitCode).toBe(3);
  });

  it('rejects with failed and a non-empty message when git writes no error output', async () => {
    const git = await fakeGit('exit 2');
    const error = await gitErrorOf(new GitRunner(git).run(dir, ['rev-parse', 'HEAD']));
    expect(error.kind).toBe('failed');
    expect(error.exitCode).toBe(2);
    expect(error.message.trim()).not.toBe('');
  });

  it('rejects with output_too_large when the output passes 5 MB', async () => {
    const git = await fakeGit('head -c 6000000 /dev/zero');
    const error = await gitErrorOf(new GitRunner(git).run(dir, ['rev-parse', 'HEAD']));
    expect(error.kind).toBe('output_too_large');
    expect(error.message).toBe('The git output is larger than 5 MB.');
  });

  it('gives an output just under 5 MB', async () => {
    const git = await fakeGit('head -c 5000000 /dev/zero');
    expect((await new GitRunner(git).run(dir, ['rev-parse', 'HEAD'])).length).toBe(5_000_000);
  });

  it('rejects with timeout and stops git after 10 s', { timeout: 20_000 }, async () => {
    const pidFile = path.join(dir, 'slow.pid');
    const git = await fakeGit(`echo $$ > '${pidFile}'; exec sleep 30`);
    const started = Date.now();
    const error = await gitErrorOf(new GitRunner(git).run(dir, ['rev-parse', 'HEAD']));
    const elapsed = Date.now() - started;
    expect(error.kind).toBe('timeout');
    expect(error.message).toBe('git did not answer within 10 s.');
    expect(elapsed).toBeGreaterThanOrEqual(9_900);
    expect(elapsed).toBeLessThan(15_000);
    const pid = Number((await readFile(pidFile, 'utf8')).trim());
    expect(() => process.kill(pid, 0), 'the git process is stopped').toThrow();
  });
});

describe('GitRunner.run with successExitCodes', () => {
  it('gives the stdout of an exit code listed as success', async () => {
    const git = await fakeGit('echo listed; exit 1');
    expect(await new GitRunner(git).run(dir, ['diff', '--no-index'], { successExitCodes: [1] })).toBe('listed\n');
  });

  it('still rejects with failed for an exit code not listed', async () => {
    const git = await fakeGit('echo boom >&2; exit 2');
    const error = await gitErrorOf(new GitRunner(git).run(dir, ['diff'], { successExitCodes: [1] }));
    expect(error.kind).toBe('failed');
    expect(error.exitCode).toBe(2);
  });

  it('rejects exit code 1 when no success codes are given', async () => {
    const git = await fakeGit('exit 1');
    expect((await gitErrorOf(new GitRunner(git).run(dir, ['diff']))).kind).toBe('failed');
  });
});

describe('GitRunner.runCapped', () => {
  // plan-git_explorer/REQ-15: a huge diff output is cut, not an error
  it('gives the first 5 MB and truncated: true for an output over 5 MB', async () => {
    const git = await fakeGit('head -c 6000000 /dev/zero');
    const result = await new GitRunner(git).runCapped(dir, ['diff']);
    expect(result.truncated).toBe(true);
    expect(result.output.length).toBe(5 * 1024 * 1024);
  });

  it('gives the whole output and truncated: false under 5 MB', async () => {
    const git = await fakeGit('echo small');
    expect(await new GitRunner(git).runCapped(dir, ['diff'])).toEqual({ output: 'small\n', truncated: false });
  });

  it('applies successExitCodes as run does', async () => {
    const git = await fakeGit('echo listed; exit 1');
    expect(await new GitRunner(git).runCapped(dir, ['diff', '--no-index'], { successExitCodes: [1] })).toEqual({ output: 'listed\n', truncated: false });
  });

  it('rejects a command off the read list without starting git', async () => {
    const log = path.join(dir, 'capped-rejected.log');
    const git = await fakeGit(`echo ran > '${log}'`);
    await expect(new GitRunner(git).runCapped(dir, ['commit', '-m', 'x'])).rejects.toBeInstanceOf(GitCommandRejected);
    expect(existsSync(log)).toBe(false);
  });

  it('rejects with failed on a git error', async () => {
    const git = await fakeGit(`echo 'fatal: bad revision' >&2; exit 128`);
    const error = await gitErrorOf(new GitRunner(git).runCapped(dir, ['diff']));
    expect(error.kind).toBe('failed');
    expect(error.message).toBe('fatal: bad revision');
  });
});
