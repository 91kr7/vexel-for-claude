import { useEffect, useState } from 'react';
import type { ChangeKind } from './changes-store';

export interface CommitFile {
  kind: Exclude<ChangeKind, 'untracked'>;
  path: string;
  oldPath?: string;
  binary: boolean;
}

export type CommitFilesState = { status: 'loading' } | { status: 'loaded'; files: CommitFile[] } | { status: 'error'; message: string };

const READ_FAILED = 'Could not read the files of the commit.';

async function readFiles(root: string, hash: string, signal: AbortSignal): Promise<CommitFilesState> {
  try {
    const query = new URLSearchParams({ path: root, hash });
    const response = await fetch(`/api/git/commit-files?${query.toString()}`, { signal });
    const body = (await response.json()) as { files?: unknown; message?: unknown };
    if (!response.ok) return { status: 'error', message: typeof body.message === 'string' ? body.message : READ_FAILED };
    if (!Array.isArray(body.files)) return { status: 'error', message: READ_FAILED };
    return { status: 'loaded', files: body.files as CommitFile[] };
  } catch {
    return { status: 'error', message: READ_FAILED };
  }
}

export function useCommitFiles(root: string, hash: string): CommitFilesState {
  const [state, setState] = useState<CommitFilesState>({ status: 'loading' });

  useEffect(() => {
    setState({ status: 'loading' });
    const controller = new AbortController();
    void readFiles(root, hash, controller.signal).then((result) => {
      if (!controller.signal.aborted) setState(result);
    });
    return () => controller.abort();
  }, [root, hash]);

  return state;
}
