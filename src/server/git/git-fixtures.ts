// Test support: real git repositories in temp folders, for the git module tests.
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export function git(folder: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], {
    cwd: folder,
    encoding: 'utf8',
  }).trim();
}

/** A new temp folder, real path (no symlinks), outside any repository. */
export async function tempFolder(prefix: string): Promise<string> {
  return realpath(await mkdtemp(path.join(os.tmpdir(), prefix)));
}

/** A repository on `branch` with one commit and the subfolder `sub`. */
export async function repoWithCommit(parent: string, name: string, branch = 'main'): Promise<string> {
  const root = path.join(parent, name);
  await mkdir(path.join(root, 'sub'), { recursive: true });
  git(root, 'init', '-q', '-b', branch);
  await writeFile(path.join(root, 'sub', 'file.txt'), 'one\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'first');
  return root;
}
