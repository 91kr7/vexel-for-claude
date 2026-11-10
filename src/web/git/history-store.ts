import { useCallback, useEffect, useRef, useState } from 'react';

export interface Commit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  /** Author date, ISO 8601. */
  date: string;
}

export type HistoryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; commits: Commit[]; hasMore: boolean; loadingMore: boolean; moreError?: string }
  | { status: 'error'; message: string };

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

/** History of `root` in pages; `undefined` → nothing is read yet. */
export function useHistory(root: string | undefined): { history: HistoryState; loadMore: () => void } {
  const [history, setHistory] = useState<HistoryState>({ status: 'idle' });
  const controller = useRef<AbortController>(undefined);
  const latest = useRef(history);
  latest.current = history;

  useEffect(() => {
    if (root === undefined) {
      setHistory({ status: 'idle' });
      return;
    }
    setHistory({ status: 'loading' });
    const current = new AbortController();
    controller.current = current;
    void readPage(root, 0, current.signal).then((page) => {
      if (current.signal.aborted) return;
      setHistory('message' in page ? { status: 'error', message: page.message } : { status: 'loaded', ...page, loadingMore: false });
    });
    return () => current.abort();
  }, [root]);

  const loadMore = useCallback(() => {
    const state = latest.current;
    const current = controller.current;
    if (root === undefined || current === undefined || state.status !== 'loaded' || !state.hasMore || state.loadingMore) return;
    const loaded = state.commits;
    setHistory({ ...state, loadingMore: true, moreError: undefined });
    void readPage(root, loaded.length, current.signal).then((page) => {
      if (current.signal.aborted) return;
      setHistory(
        'message' in page
          ? { status: 'loaded', commits: loaded, hasMore: true, loadingMore: false, moreError: page.message }
          : { status: 'loaded', commits: [...loaded, ...page.commits], hasMore: page.hasMore, loadingMore: false },
      );
    });
  }, [root]);

  return { history, loadMore };
}
