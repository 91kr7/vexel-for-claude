import { lstat, readdir, realpath, stat } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';
import { setImmediate as yieldToEventLoop } from 'node:timers/promises';
import { GitError, type GitRunner } from './git-runner.js';
import { branchOf, lookupRepository, type BranchInfo } from './repository-lookup.js';

export type CoveredRepository = { root: string; name: string; path: string } & ({ branch: BranchInfo } | { error: string });

export type RepositoryDetection = { status: 'repositories'; repositories: CoveredRepository[] } | { status: 'none' };

export const MAX_DETECTION_DEPTH = 4;
const BRANCH_LOOKUP_CONCURRENCY = 4;
const NOT_A_REPOSITORY = 'Not a valid git repository.';

export const SKIPPED_FOLDERS: ReadonlySet<string> = new Set([
  'node_modules',
  'bower_components',
  'jspm_packages',
  'vendor',
  '.venv',
  'venv',
  '__pycache__',
  '.tox',
  '.gradle',
  '.m2',
  'target',
  'build',
  'dist',
  'out',
  '.next',
  '.nuxt',
  '.dart_tool',
  'Pods',
  '.terraform',
]);

type Runner = Pick<GitRunner, 'run'>;

const NONE: RepositoryDetection = { status: 'none' };

async function realFolderOf(folder: string): Promise<string | undefined> {
  try {
    const real = await realpath(folder);
    return (await stat(real)).isDirectory() ? real : undefined;
  } catch {
    return undefined;
  }
}

async function hasGitEntry(folder: string): Promise<boolean> {
  try {
    const entry = await lstat(join(folder, '.git'));
    return entry.isDirectory() || entry.isFile();
  } catch {
    return false;
  }
}

async function readFolder(folder: string): Promise<{ hasGit: boolean; children: string[] }> {
  try {
    const entries = await readdir(folder, { withFileTypes: true });
    return {
      hasGit: entries.some((entry) => entry.name === '.git' && (entry.isDirectory() || entry.isFile())),
      children: entries
        .filter((entry) => entry.isDirectory() && entry.name !== '.git' && !SKIPPED_FOLDERS.has(entry.name))
        .map((entry) => join(folder, entry.name)),
    };
  } catch {
    return { hasGit: false, children: [] };
  }
}

/** Whether the repository around `folder` tracks it as a gitlink (mode 160000), as a submodule. */
async function isGitlink(runner: Runner, folder: string): Promise<boolean> {
  const name = basename(folder);
  try {
    const output = await runner.run(dirname(folder), ['ls-files', '--stage', '-z', '--', `:(literal)${name}`]);
    return output.split('\0').some((line) => line.startsWith('160000 ') && line.slice(line.indexOf('\t') + 1) === name);
  } catch {
    return false;
  }
}

/** Folders with a `.git` entry, at most MAX_DETECTION_DEPTH levels below `top`; symbolic links are not followed. */
async function findCandidates(runner: Runner, top: string): Promise<string[]> {
  const candidates: string[] = [];
  const queue: { folder: string; level: number }[] = [{ folder: top, level: 0 }];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    const { folder, level } = next;
    await yieldToEventLoop();
    const { hasGit, children } = level < MAX_DETECTION_DEPTH ? await readFolder(folder) : { hasGit: await hasGitEntry(folder), children: [] };
    if (hasGit) {
      if (level > 0 && (await isGitlink(runner, folder))) continue;
      candidates.push(folder);
    }
    for (const child of children) queue.push({ folder: child, level: level + 1 });
  }
  return candidates;
}

/** Rejects with the GitError only when git is not installed. */
async function describe(runner: Runner, root: string): Promise<{ branch: BranchInfo } | { error: string }> {
  try {
    const toplevel = (await runner.run(root, ['rev-parse', '--show-toplevel'])).trim();
    if (toplevel !== root) return { error: NOT_A_REPOSITORY };
    return { branch: await branchOf(runner, root) };
  } catch (error) {
    if (error instanceof GitError && error.kind !== 'not_installed') return { error: error.message };
    throw error;
  }
}

async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, map: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let index = 0;
  const worker = async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await map(items[current] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function comparePaths(left: string, right: string): number {
  const a = left.split('/');
  const b = right.split('/');
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a[i] as string;
    const y = b[i] as string;
    if (x !== y) return x < y ? -1 : 1;
  }
  return a.length - b.length;
}

/** The covered repositories of `folder`: the one around it first, then the ones below it in path order. */
export async function detectRepositories(runner: Runner, folder: string): Promise<RepositoryDetection> {
  const top = await realFolderOf(folder);
  if (top === undefined) return NONE;
  const entryOf = (root: string) => ({ root, name: basename(root), path: relative(top, root) || '.' });

  let first: CoveredRepository | undefined;
  try {
    const around = await lookupRepository(runner, top);
    if (around.status === 'repository') first = { ...entryOf(around.root), branch: around.branch };
  } catch (error) {
    if (!(error instanceof GitError)) throw error;
    first = { ...entryOf(top), error: error.message };
  }

  const roots = (await findCandidates(runner, top))
    .filter((root) => root !== first?.root)
    .sort((left, right) => comparePaths(relative(top, left), relative(top, right)));
  let nested: CoveredRepository[];
  try {
    nested = await mapWithConcurrency(roots, BRANCH_LOOKUP_CONCURRENCY, async (root) => ({ ...entryOf(root), ...(await describe(runner, root)) }));
  } catch (error) {
    if (error instanceof GitError && error.kind === 'not_installed') return NONE;
    throw error;
  }

  const repositories = first === undefined ? nested : [first, ...nested];
  return repositories.length === 0 ? NONE : { status: 'repositories', repositories };
}
