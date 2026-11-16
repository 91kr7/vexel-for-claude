import type { Commit } from './history-store';

/** The loaded pages of one repository, in git order. */
export interface RepositoryHistory {
  root: string;
  commits: readonly Commit[];
  hasMore: boolean;
}

/** A commit of the combined history, with the root of its repository. */
export interface RepositoryCommit {
  root: string;
  commit: Commit;
}

export interface MergedHistory {
  commits: RepositoryCommit[];
  /** Roots with more pages whose loaded commits all show: "Load more" reads their next page. */
  border: string[];
  hasMore: boolean;
}

const timeOf = (commit: Commit) => {
  const time = Date.parse(commit.committerDate ?? commit.date);
  return Number.isNaN(time) ? -Infinity : time;
};

/**
 * Newest first by committer date, each repository in its own order. Stops when a repository with more pages
 * has shown all its loaded commits, since its next commit could be newer than any commit still to show.
 */
export function mergeHistories(histories: readonly RepositoryHistory[]): MergedHistory {
  const next = histories.map(() => 0);
  const headOf = (index: number) => histories[index]?.commits[next[index] ?? 0];
  const atBorder = (history: RepositoryHistory, index: number) => history.hasMore && headOf(index) === undefined;
  const commits: RepositoryCommit[] = [];
  while (!histories.some(atBorder)) {
    let pick = -1;
    let pickTime = -Infinity;
    histories.forEach((_, index) => {
      const head = headOf(index);
      if (head !== undefined && (pick === -1 || timeOf(head) > pickTime)) {
        pick = index;
        pickTime = timeOf(head);
      }
    });
    const head = headOf(pick);
    const history = histories[pick];
    if (head === undefined || history === undefined) break;
    commits.push({ root: history.root, commit: head });
    next[pick] = (next[pick] ?? 0) + 1;
  }
  const border = histories.filter(atBorder).map((history) => history.root);
  return { commits, border, hasMore: border.length > 0 };
}
