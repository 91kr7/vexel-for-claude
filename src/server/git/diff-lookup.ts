import { repositoryRootOf } from './changes-lookup.js';
import type { GitRunner } from './git-runner.js';
import { parseDiff, type FileDiff } from './diff-parser.js';
import type { ChangeGroup } from './status-parser.js';

export interface DiffRequest {
  group: ChangeGroup;
  /** Path from the repository root. */
  file: string;
  /** Path before a rename. */
  oldPath?: string;
}

const DIFF_OPTIONS = ['--no-ext-diff', '--no-textconv', '--no-color'];

const literal = (path: string) => `:(literal)${path}`;

function diffArgs({ group, file, oldPath }: DiffRequest): string[] {
  const cached = group === 'staged' ? ['--cached'] : [];
  const renames = oldPath === undefined ? [] : ['-M'];
  const paths = oldPath === undefined ? [literal(file)] : [literal(oldPath), literal(file)];
  return ['diff', ...cached, ...DIFF_OPTIONS, ...renames, '--', ...paths];
}

type Runner = Pick<GitRunner, 'run' | 'runCapped'>;

async function isTracked(runner: Runner, root: string, file: string): Promise<boolean> {
  return (await runner.run(root, ['ls-files', '-z', '--', literal(file)])) !== '';
}

export async function lookupFileDiff(runner: Runner, folder: string, request: DiffRequest): Promise<FileDiff> {
  const root = await repositoryRootOf(runner, folder);
  if (request.group === 'unstaged' && !(await isTracked(runner, root, request.file))) {
    // `diff --no-index` exits with 1 when the files differ.
    const { output, truncated } = await runner.runCapped(root, ['diff', '--no-index', ...DIFF_OPTIONS, '--', '/dev/null', request.file], {
      successExitCodes: [1],
    });
    return parseDiff(output, truncated);
  }
  const { output, truncated } = await runner.runCapped(root, diffArgs(request));
  return parseDiff(output, truncated);
}
