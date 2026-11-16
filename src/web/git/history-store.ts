import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mergeHistories, type RepositoryCommit, type RepositoryHistory } from './history-merge';

export interface Commit {
  hash: string;
  shortHash: string;
  /** Full hashes of the parents, first parent first; empty or absent for a root commit. */
  parents?: string[];
  message: string;
  author: string;
  /** Author date, ISO 8601. */
  date: string;
  /** Committer date, ISO 8601; the merge falls back to `date` without it. */
  committerDate?: string;
}

export interface RepositoryError {
  root: string;
  message: string;
}

export type HistoryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'loaded';
      commits: RepositoryCommit[];
      hasMore: boolean;
      loadingMore: boolean;
      moreError?: string;
      /** First-page errors, in the order of the roots. */
      errors: RepositoryError[];
    };

type PageResult = { commits: Commit[]; hasMore: boolean } | { message: string };

const READ_FAILED = 'Could not read the history.';

async function readPage(root: string, offset: number, signal: AbortSignal): Promise<PageResult> {
  try {
    const response = await fetch(`/api/git/history?path=${encodeURIComponent(root)}&offset=${offset}`, { signal });
    const body = (await response.json()) as { commits?: unknown; hasMore?: unknown; message?: unknown };
    if (!response.ok) return { message: typeof body.message === 'string' ? body.message : READ_FAILED };
    if (!Array.isArray(body.commits) || typeof body.hasMore !== 'boolean') return { message: READ_FAILED };
    return { commits: body.commits as Commit[], hasMore: body.hasMore };
  } catch {
    return { message: READ_FAILED };
  }
}

interface Stored {
  key?: string;
  /** One result per root, in the order of the roots. */
  results: (RepositoryHistory | RepositoryError)[];
  loadingMore: boolean;
  moreError?: string;
}

const IDLE: HistoryState = { status: 'idle' };
const LOADING: HistoryState = { status: 'loading' };
const EMPTY: Stored = { results: [], loadingMore: false };

const toResult = (root: string, page: PageResult): RepositoryHistory | RepositoryError =>
  'message' in page ? { root, message: page.message } : { root, ...page };

const isHistory = (result: RepositoryHistory | RepositoryError): result is RepositoryHistory => 'commits' in result;

/**
 * Combined history of `roots` in pages; no roots → nothing is read. The first page of every root is read when the
 * list changes and at each new `revision`; the state changes in one step, once every root has answered.
 */
export function useHistory(roots: readonly string[], revision = 0): { history: HistoryState; loadMore: () => void } {
  const key = roots.join('\0');
  const [stored, setStored] = useState<Stored>(EMPTY);
  const controller = useRef<AbortController>(undefined);
  const current = key !== '' && stored.key === key ? stored : undefined;
  const merged = useMemo(() => current && mergeHistories(current.results.filter(isHistory)), [current]);
  const history: HistoryState =
    key === ''
      ? IDLE
      : current === undefined || merged === undefined
        ? LOADING
        : {
            status: 'loaded',
            commits: merged.commits,
            hasMore: merged.hasMore,
            loadingMore: current.loadingMore,
            moreError: current.moreError,
            errors: current.results.filter((result): result is RepositoryError => !isHistory(result)),
          };
  const latest = useRef({ current, merged });
  latest.current = { current, merged };

  useEffect(() => {
    if (key === '') return;
    const list = key.split('\0');
    const request = new AbortController();
    controller.current = request;
    // A refresh keeps the shown commits, with "Load more" blocked until every first page answers.
    setStored((previous) => (previous.key === key ? { ...previous, loadingMore: true, moreError: undefined } : previous));
    void Promise.all(list.map((root) => readPage(root, 0, request.signal))).then((pages) => {
      if (request.signal.aborted) return;
      setStored({ key, results: list.map((root, index) => toResult(root, pages[index] ?? { message: READ_FAILED })), loadingMore: false });
    });
    return () => request.abort();
  }, [key, revision]);

  const loadMore = useCallback(() => {
    const { current: state, merged: shown } = latest.current;
    const request = controller.current;
    if (state === undefined || shown === undefined || request === undefined || !shown.hasMore || state.loadingMore) return;
    setStored({ ...state, loadingMore: true, moreError: undefined });
    const border = state.results.filter((result): result is RepositoryHistory => isHistory(result) && shown.border.includes(result.root));
    void Promise.all(border.map((result) => readPage(result.root, result.commits.length, request.signal))).then((pages) => {
      if (request.signal.aborted) return;
      let moreError: string | undefined;
      const results = state.results.map((result) => {
        const index = border.indexOf(result as RepositoryHistory);
        const page = pages[index];
        if (index === -1 || page === undefined || !isHistory(result)) return result;
        if ('message' in page) {
          moreError ??= page.message;
          return result;
        }
        return { root: result.root, commits: [...result.commits, ...page.commits], hasMore: page.hasMore };
      });
      setStored({ key: state.key, results, loadingMore: false, moreError });
    });
  }, []);

  return { history, loadMore };
}
