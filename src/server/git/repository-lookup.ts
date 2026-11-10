import { stat } from 'node:fs/promises';
import { GitError, type GitRunner } from './git-runner.js';

export type BranchInfo = { kind: 'branch'; name: string } | { kind: 'detached'; hash: string };

export type RepositoryLookup = { status: 'repository'; root: string; branch: BranchInfo } | { status: 'none' };

const NONE: RepositoryLookup = { status: 'none' };

async function isFolder(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

const isOutsideRepository = (error: unknown) =>
  error instanceof GitError &&
  (error.kind === 'not_installed' || error.kind === 'folder_not_found' || (error.kind === 'failed' && /not a git repository/i.test(error.message)));

async function branchOf(runner: Pick<GitRunner, 'run'>, root: string): Promise<BranchInfo> {
  try {
    const name = (await runner.run(root, ['symbolic-ref', '--short', '-q', 'HEAD'])).trim();
    if (name !== '') return { kind: 'branch', name };
  } catch (error) {
    // `symbolic-ref -q` exits with 1 and no message when HEAD is detached.
    if (!(error instanceof GitError && error.kind === 'failed' && error.exitCode === 1)) throw error;
  }
  const hash = (await runner.run(root, ['rev-parse', '--short', 'HEAD'])).trim();
  return { kind: 'detached', hash };
}

export async function lookupRepository(runner: Pick<GitRunner, 'run'>, folder: string): Promise<RepositoryLookup> {
  if (!(await isFolder(folder))) return NONE;
  let root: string;
  try {
    root = (await runner.run(folder, ['rev-parse', '--show-toplevel'])).trim();
  } catch (error) {
    if (isOutsideRepository(error)) return NONE;
    throw error;
  }
  return { status: 'repository', root, branch: await branchOf(runner, root) };
}
