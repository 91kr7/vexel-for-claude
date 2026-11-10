import type { GitRunner } from './git-runner.js';
import { LOG_FORMAT, parseLog, type Commit } from './log-parser.js';

export const HISTORY_PAGE_SIZE = 100;

export interface HistoryPage {
  commits: Commit[];
  hasMore: boolean;
}

type Runner = Pick<GitRunner, 'run'>;

async function hasCommits(runner: Runner, folder: string): Promise<boolean> {
  return (await runner.run(folder, ['rev-parse', '--verify', '-q', 'HEAD'], { successExitCodes: [1] })).trim() !== '';
}

export async function lookupHistory(runner: Runner, folder: string, offset = 0): Promise<HistoryPage> {
  if (!(await hasCommits(runner, folder))) return { commits: [], hasMore: false };
  // One commit past the page tells whether a next page exists.
  const output = await runner.run(folder, [
    'log',
    '-z',
    '--no-color',
    '--no-show-signature',
    LOG_FORMAT,
    `--skip=${offset}`,
    `--max-count=${HISTORY_PAGE_SIZE + 1}`,
    'HEAD',
    '--',
  ]);
  const commits = parseLog(output);
  return { commits: commits.slice(0, HISTORY_PAGE_SIZE), hasMore: commits.length > HISTORY_PAGE_SIZE };
}
