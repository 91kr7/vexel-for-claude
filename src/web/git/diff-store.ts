import { useEffect, useState } from 'react';
import type { ChangeEntry } from './changes-store';

export type DiffLineKind = 'added' | 'removed' | 'context' | 'hunk';

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
}

export interface FileDiff {
  binary: boolean;
  cut: boolean;
  lines: DiffLine[];
}

export type FileDiffState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; diff: FileDiff }
  | { status: 'error'; message: string };

const READ_FAILED = 'Could not read the diff.';

function diffUrl(root: string, { group, path, oldPath }: ChangeEntry): string {
  const query = new URLSearchParams({ path: root, group, file: path });
  if (oldPath !== undefined) query.set('oldPath', oldPath);
  return `/api/git/diff?${query.toString()}`;
}

async function readDiff(root: string, entry: ChangeEntry, signal: AbortSignal): Promise<FileDiffState> {
  try {
    const response = await fetch(diffUrl(root, entry), { signal });
    const body = (await response.json()) as Partial<FileDiff> & { message?: unknown };
    if (!response.ok) return { status: 'error', message: typeof body.message === 'string' ? body.message : READ_FAILED };
    if (typeof body.binary !== 'boolean' || typeof body.cut !== 'boolean' || !Array.isArray(body.lines)) {
      return { status: 'error', message: READ_FAILED };
    }
    return { status: 'loaded', diff: { binary: body.binary, cut: body.cut, lines: body.lines } };
  } catch {
    return { status: 'error', message: READ_FAILED };
  }
}

export function useFileDiff(root: string, entry: ChangeEntry | undefined): FileDiffState {
  const [state, setState] = useState<FileDiffState>({ status: 'idle' });

  useEffect(() => {
    if (entry === undefined) {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'loading' });
    const controller = new AbortController();
    void readDiff(root, entry, controller.signal).then((result) => {
      if (!controller.signal.aborted) setState(result);
    });
    return () => controller.abort();
  }, [root, entry]);

  return state;
}
