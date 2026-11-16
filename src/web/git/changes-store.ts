import { useEffect, useRef, useState } from 'react';

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

/**
 * One state per root, in the order of `roots`. Each root is read once, and again at each new `revision`;
 * a new revision keeps the current state of a root until its answer.
 */
export function useChanges(roots: readonly string[], revision = 0): ChangesState[] {
  const [stored, setStored] = useState<ReadonlyMap<string, ChangesState>>(new Map());
  const requests = useRef(new Map<string, { revision: number; controller: AbortController }>());
  const rootsKey = roots.join('\0');

  useEffect(() => {
    const current = new Set(rootsKey === '' ? [] : rootsKey.split('\0'));
    const gone = [...requests.current.keys()].filter((root) => !current.has(root));
    for (const root of gone) {
      requests.current.get(root)?.controller.abort();
      requests.current.delete(root);
    }
    if (gone.length > 0) {
      setStored((states) => new Map([...states].filter(([root]) => current.has(root))));
    }
    for (const root of current) {
      const previous = requests.current.get(root);
      if (previous?.revision === revision) continue;
      previous?.controller.abort();
      const controller = new AbortController();
      requests.current.set(root, { revision, controller });
      void readChanges(root, controller.signal).then((result) => {
        if (!controller.signal.aborted) setStored((states) => new Map(states).set(root, result));
      });
    }
  }, [rootsKey, revision]);

  useEffect(() => {
    const active = requests.current;
    return () => {
      for (const request of active.values()) request.controller.abort();
      active.clear();
    };
  }, []);

  return roots.map((root) => stored.get(root) ?? LOADING);
}
