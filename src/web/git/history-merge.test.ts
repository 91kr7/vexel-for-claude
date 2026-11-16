// Unit tests of mergeHistories (plan-multi_repo_workspace, batch combined-history).
import { describe, expect, it } from 'vitest';
import { mergeHistories, type RepositoryHistory } from './history-merge';
import type { Commit } from './history-store';

const A = '/ws/api';
const B = '/ws/web/app';
const C = '/ws/lib';

/** A commit whose committer date is `day` of November 2026, at `hour`. */
const at = (hash: string, day: number, hour = 12, authorDay = 1): Commit => ({
  hash,
  shortHash: hash.slice(0, 7),
  message: hash,
  author: 'Ada',
  date: `2026-11-${String(authorDay).padStart(2, '0')}T12:00:00Z`,
  committerDate: `2026-11-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00Z`,
});

const repo = (root: string, commits: Commit[], hasMore = false): RepositoryHistory => ({ root, commits, hasMore });
const order = (histories: RepositoryHistory[]) => mergeHistories(histories).commits.map(({ root, commit }) => `${root}:${commit.hash}`);

describe('mergeHistories', () => {
  it('gives an empty list and no more with no repositories', () => {
    expect(mergeHistories([])).toEqual({ commits: [], border: [], hasMore: false });
  });

  // plan-multi_repo_workspace/REQ-21
  it('merges the commits of two repositories newest first by committer date, each with its root', () => {
    const result = mergeHistories([repo(A, [at('a3', 9), at('a2', 6), at('a1', 2)]), repo(B, [at('b3', 8), at('b2', 5), at('b1', 3)])]);
    expect(result.commits.map(({ root, commit }) => [root, commit.hash])).toEqual([
      [A, 'a3'],
      [B, 'b3'],
      [A, 'a2'],
      [B, 'b2'],
      [B, 'b1'],
      [A, 'a1'],
    ]);
    expect(result.hasMore).toBe(false);
    expect(result.border).toEqual([]);
  });

  // plan-multi_repo_workspace/REQ-21: the committer date counts, not the author date
  it('orders by committer date, not by author date', () => {
    const a = { ...at('a1', 5), date: '2026-11-20T12:00:00Z' };
    const b = { ...at('b1', 9), date: '2026-11-01T12:00:00Z' };
    expect(order([repo(A, [a]), repo(B, [b])])).toEqual([`${B}:b1`, `${A}:a1`]);
  });

  it('uses the author date when a commit has no committer date', () => {
    const { committerDate: _drop, ...a } = at('a1', 1, 12, 7);
    expect(order([repo(A, [a]), repo(B, [at('b1', 5)])])).toEqual([`${A}:a1`, `${B}:b1`]);
  });

  it('counts a date that does not parse as the oldest', () => {
    const a = { ...at('a1', 1), committerDate: 'not a date' };
    expect(order([repo(A, [a]), repo(B, [at('b1', 1)])])).toEqual([`${B}:b1`, `${A}:a1`]);
  });

  it('puts the repository earlier in the list first on equal dates', () => {
    expect(order([repo(B, [at('b1', 4)]), repo(A, [at('a1', 4)])])).toEqual([`${B}:b1`, `${A}:a1`]);
    expect(order([repo(A, [at('a1', 4)]), repo(B, [at('b1', 4)])])).toEqual([`${A}:a1`, `${B}:b1`]);
  });

  it('compares instants across time zones', () => {
    const a = { ...at('a1', 1), committerDate: '2026-11-05T10:00:00+02:00' };
    const b = { ...at('b1', 1), committerDate: '2026-11-05T09:30:00Z' };
    expect(order([repo(A, [a]), repo(B, [b])])).toEqual([`${B}:b1`, `${A}:a1`]);
  });

  // plan-multi_repo_workspace/REQ-24: each repository keeps its own order, whatever the dates
  it('keeps the order of each repository even when its dates are out of order', () => {
    const result = order([repo(A, [at('a2', 2), at('a1', 9)]), repo(B, [at('b1', 5)])]);
    expect(result).toEqual([`${B}:b1`, `${A}:a2`, `${A}:a1`]);
    expect(result.indexOf(`${A}:a2`)).toBeLessThan(result.indexOf(`${A}:a1`));
  });

  // plan-multi_repo_workspace/REQ-21, REQ-24: border between parts
  it('stops at the oldest loaded commit of a repository with more pages, and names it as border', () => {
    const result = mergeHistories([repo(A, [at('a3', 9), at('a2', 7)], true), repo(B, [at('b3', 8), at('b2', 6), at('b1', 3)])]);
    expect(result.commits.map(({ commit }) => commit.hash)).toEqual(['a3', 'b3', 'a2']);
    expect(result.border).toEqual([A]);
    expect(result.hasMore).toBe(true);
  });

  it('shows every loaded commit of a repository with no more pages before the border of another stops the list', () => {
    const result = mergeHistories([repo(A, [at('a1', 2)]), repo(B, [at('b2', 9), at('b1', 8)], true)]);
    expect(result.commits.map(({ commit }) => commit.hash)).toEqual(['b2', 'b1']);
    expect(result.border).toEqual([B]);
    expect(result.hasMore).toBe(true);
  });

  it('leaves out of the border a repository with more pages that still has loaded commits left', () => {
    const result = mergeHistories([repo(A, [at('a2', 9), at('a1', 8)], true), repo(B, [at('b2', 7), at('b1', 1)], true)]);
    expect(result.commits.map(({ commit }) => commit.hash)).toEqual(['a2', 'a1']);
    expect(result.border).toEqual([A]);
  });

  it('names as border every repository with more pages that has shown all its loaded commits, in the order of the list', () => {
    const result = mergeHistories([repo(C, [at('c1', 1)]), repo(B, [], true), repo(A, [], true)]);
    expect(result.commits).toEqual([]);
    expect(result.border).toEqual([B, A]);
    expect(result.hasMore).toBe(true);
  });

  it('stops before anything when a repository with more pages has no loaded commit', () => {
    const result = mergeHistories([repo(A, [at('a1', 9)]), repo(B, [], true)]);
    expect(result.commits).toEqual([]);
    expect(result.border).toEqual([B]);
  });

  it('gives no more when only a repository with no more pages is left', () => {
    const result = mergeHistories([repo(A, [at('a1', 9)], false), repo(B, [at('b1', 3)], false)]);
    expect(result.hasMore).toBe(false);
    expect(result.border).toEqual([]);
  });

  it('gives one repository its commits in their order and its own hasMore', () => {
    const commits = [at('a1', 1), at('a3', 9), at('a2', 5)];
    const withMore = mergeHistories([repo(A, commits, true)]);
    expect(withMore.commits).toEqual(commits.map((commit) => ({ root: A, commit })));
    expect(withMore).toMatchObject({ border: [A], hasMore: true });
    const done = mergeHistories([repo(A, commits, false)]);
    expect(done.commits).toHaveLength(3);
    expect(done).toMatchObject({ border: [], hasMore: false });
  });

  it('keeps the same hash of two clones as two separate entries', () => {
    const shared = at('same', 4);
    expect(order([repo(A, [shared]), repo(B, [shared])])).toEqual([`${A}:same`, `${B}:same`]);
  });

  it('is pure: the same input gives the same output and the input is left untouched', () => {
    const input = [repo(A, [at('a2', 9), at('a1', 2)], true), repo(B, [at('b1', 5)])];
    const copy = structuredClone(input);
    expect(mergeHistories(input)).toEqual(mergeHistories(input));
    expect(input).toEqual(copy);
  });
});
