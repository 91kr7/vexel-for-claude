import { repositoryRootOf } from './changes-lookup.js';
import { commitDiffTrees } from './commit-files-lookup.js';
import { parseDiff, type FileDiff } from './diff-parser.js';
import type { GitRunner } from './git-runner.js';

export interface CommitDiffRequest {
  hash: string;
  /** Path from the repository root. */
  file: string;
  /** Path before a rename. */
  oldPath?: string;
}

const literal = (path: string) => `:(literal)${path}`;

export async function lookupCommitFileDiff(runner: Pick<GitRunner, 'run' | 'runCapped'>, folder: string, request: CommitDiffRequest): Promise<FileDiff> {
  const root = await repositoryRootOf(runner, folder);
  const trees = await commitDiffTrees(runner, root, request.hash);
  const renames = request.oldPath === undefined ? [] : ['-M'];
  const paths = request.oldPath === undefined ? [literal(request.file)] : [literal(request.oldPath), literal(request.file)];
  const { output, truncated } = await runner.runCapped(root, [
    'diff-tree',
    '-p',
    '-r',
    '--no-ext-diff',
    '--no-textconv',
    '--no-color',
    ...renames,
    ...trees,
    '--',
    ...paths,
  ]);
  return parseDiff(output, truncated);
}
