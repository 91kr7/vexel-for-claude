import { repositoryRootOf } from './changes-lookup.js';
import type { GitRunner } from './git-runner.js';
import type { ChangeKind } from './status-parser.js';

export type CommitFileKind = Exclude<ChangeKind, 'untracked'>;

export interface CommitFile {
  kind: CommitFileKind;
  /** Path from the repository root. */
  path: string;
  /** Path before the rename, only for `renamed`. */
  oldPath?: string;
  binary: boolean;
}

type Runner = Pick<GitRunner, 'run'>;

/** The diff-tree arguments that compare a commit with its first parent, or with the empty tree for a first commit. */
export async function commitDiffTrees(runner: Runner, root: string, hash: string): Promise<string[]> {
  const parent = (await runner.run(root, ['rev-parse', '--verify', '-q', `${hash}^1`], { successExitCodes: [1] })).trim();
  return parent === '' ? ['--root', '--no-commit-id', hash] : [parent, hash];
}

const KIND_OF_CODE: Record<string, CommitFileKind> = {
  A: 'added',
  C: 'added',
  M: 'modified',
  T: 'modified',
  D: 'deleted',
  R: 'renamed',
};

// `diff-tree -z --raw --numstat`: the raw records of every file, then their numstat records in the same order.
function parseRawAndNumstat(output: string): CommitFile[] {
  const tokens = output.split('\0');
  const files: (CommitFile | undefined)[] = [];
  const binaryMarks: boolean[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? '';
    if (token === '') continue;
    if (token.startsWith(':')) {
      const code = token.split(' ')[4]?.charAt(0) ?? '';
      const twoPaths = code === 'R' || code === 'C';
      const first = tokens[(index += 1)] ?? '';
      const second = twoPaths ? (tokens[(index += 1)] ?? '') : undefined;
      const kind = KIND_OF_CODE[code];
      if (kind === undefined) files.push(undefined);
      else if (second === undefined) files.push({ kind, path: first, binary: false });
      else if (kind === 'renamed') files.push({ kind, path: second, oldPath: first, binary: false });
      else files.push({ kind, path: second, binary: false });
      continue;
    }
    binaryMarks.push(token.startsWith('-\t-\t'));
    // A rename numstat record has an empty path field, then the old and new paths.
    if (token.split('\t')[2] === '') index += 2;
  }
  return files.flatMap((file, position) => (file === undefined ? [] : [{ ...file, binary: binaryMarks[position] ?? false }]));
}

export async function lookupCommitFiles(runner: Runner, folder: string, hash: string): Promise<CommitFile[]> {
  const root = await repositoryRootOf(runner, folder);
  const trees = await commitDiffTrees(runner, root, hash);
  const output = await runner.run(root, ['diff-tree', '-r', '-z', '-M', '--raw', '--numstat', ...trees]);
  return parseRawAndNumstat(output);
}
