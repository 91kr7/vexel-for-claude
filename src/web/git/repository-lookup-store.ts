import { useEffect, useState } from 'react';

export type BranchInfo = { kind: 'branch'; name: string } | { kind: 'detached'; hash: string };

export type RepositoryLookupState =
  | { status: 'loading' }
  | { status: 'repository'; root: string; branch: BranchInfo }
  | { status: 'none' }
  | { status: 'error'; message: string };

const LOADING: RepositoryLookupState = { status: 'loading' };
const READ_FAILED = 'Could not read the repository.';

function isBranchInfo(value: unknown): value is BranchInfo {
  if (typeof value !== 'object' || value === null) return false;
  const { kind, name, hash } = value as Record<string, unknown>;
  return (kind === 'branch' && typeof name === 'string') || (kind === 'detached' && typeof hash === 'string');
}

async function lookup(folder: string, signal: AbortSignal): Promise<RepositoryLookupState> {
  try {
    const response = await fetch(`/api/git/repository?path=${encodeURIComponent(folder)}`, { signal });
    const body = (await response.json()) as { status?: unknown; root?: unknown; branch?: unknown; message?: unknown };
    if (!response.ok) return { status: 'error', message: typeof body.message === 'string' ? body.message : READ_FAILED };
    if (body.status === 'none') return { status: 'none' };
    if (body.status === 'repository' && typeof body.root === 'string' && isBranchInfo(body.branch)) {
      return { status: 'repository', root: body.root, branch: body.branch };
    }
    return { status: 'error', message: READ_FAILED };
  } catch {
    return { status: 'error', message: READ_FAILED };
  }
}

export function useRepositoryLookup(folder: string | undefined): RepositoryLookupState {
  const [state, setState] = useState<RepositoryLookupState>(LOADING);

  useEffect(() => {
    setState(LOADING);
    if (folder === undefined) return;
    const controller = new AbortController();
    void lookup(folder, controller.signal).then((result) => {
      if (!controller.signal.aborted) setState(result);
    });
    return () => controller.abort();
  }, [folder]);

  return state;
}
