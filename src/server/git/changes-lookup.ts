import type { GitRunner } from './git-runner.js';
import { parseStatus, type ChangeEntry } from './status-parser.js';

export type Runner = Pick<GitRunner, 'run'>;

export async function repositoryRootOf(runner: Runner, folder: string): Promise<string> {
  return (await runner.run(folder, ['rev-parse', '--show-toplevel'])).trim();
}

export async function lookupChanges(runner: Runner, folder: string): Promise<ChangeEntry[]> {
  const root = await repositoryRootOf(runner, folder);
  const output = await runner.run(root, ['status', '--porcelain=v2', '-z', '--untracked-files=all', '--find-renames']);
  return parseStatus(output);
}
