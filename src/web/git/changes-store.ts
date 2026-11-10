import { useEffect, useState } from 'react';

export type ChangeGroup = 'staged' | 'unstaged';

export type ChangeKind = 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked';

export interface ChangeEntry {
  group: ChangeGroup;
  kind: ChangeKind;
  path: string;
  oldPath?: string;
}

export type ChangesState = { status: 'loading' } | { status: 'loaded'; changes: ChangeEntry[] } | { status: 'error'; message: string };

const LOADING: ChangesState = { status: 'loading' };
const READ_FAILED = 'Could not read the changes.';

async function readChanges(root: string, signal: AbortSignal): Promise<ChangesState> {
  try {
    const response = await fetch(`/api/git/changes?path=${encodeURIComponent(root)}`, { signal });
    const body = (await response.json()) as { changes?: unknown; message?: unknown };
    if (!response.ok) return { status: 'error', message: typeof body.message === 'string' ? body.message : READ_FAILED };
    if (!Array.isArray(body.changes)) return { status: 'error', message: READ_FAILED };
    return { status: 'loaded', changes: body.changes as ChangeEntry[] };
  } catch {
    return { status: 'error', message: READ_FAILED };
  }
}

/** A new `revision` reads again and keeps the current state until the answer. */
export function useChanges(root: string | undefined, revision = 0): ChangesState {
  const [stored, setStored] = useState<{ root?: string; state: ChangesState }>({ state: LOADING });

  useEffect(() => {
    if (root === undefined) return;
    const controller = new AbortController();
    void readChanges(root, controller.signal).then((result) => {
      if (!controller.signal.aborted) setStored({ root, state: result });
    });
    return () => controller.abort();
  }, [root, revision]);

  return root !== undefined && stored.root === root ? stored.state : LOADING;
}
