import { useEffect, useState } from 'react';

export type BranchInfo = { kind: 'branch'; name: string } | { kind: 'detached'; hash: string };

export type CoveredRepository = { root: string; name: string; path: string } & ({ branch: BranchInfo } | { error: string });

export type RepositoryLookupState =
  | { status: 'loading' }
  | { status: 'repositories'; repositories: CoveredRepository[] }
  | { status: 'none' }
  | { status: 'error'; message: string };

const LOADING: RepositoryLookupState = { status: 'loading' };
const READ_FAILED = 'Could not read the repository.';

function isBranchInfo(value: unknown): value is BranchInfo {
  if (typeof value !== 'object' || value === null) return false;
  const { kind, name, hash } = value as Record<string, unknown>;
  return (kind === 'branch' && typeof name === 'string') || (kind === 'detached' && typeof hash === 'string');
}

function isCoveredRepository(value: unknown): value is CoveredRepository {
  if (typeof value !== 'object' || value === null) return false;
  const { root, name, path, branch, error } = value as Record<string, unknown>;
  return typeof root === 'string' && typeof name === 'string' && typeof path === 'string' && (isBranchInfo(branch) || typeof error === 'string');
}

async function lookup(folder: string, signal: AbortSignal): Promise<RepositoryLookupState> {
  try {
    const response = await fetch(`/api/git/repository?path=${encodeURIComponent(folder)}`, { signal });
    const body = (await response.json()) as { status?: unknown; repositories?: unknown; message?: unknown };
    if (!response.ok) return { status: 'error', message: typeof body.message === 'string' ? body.message : READ_FAILED };
    if (body.status === 'none') return { status: 'none' };
    if (body.status === 'repositories' && Array.isArray(body.repositories) && body.repositories.every(isCoveredRepository)) {
      return body.repositories.length === 0 ? { status: 'none' } : { status: 'repositories', repositories: body.repositories };
    }
    return { status: 'error', message: READ_FAILED };
  } catch {
    return { status: 'error', message: READ_FAILED };
  }
}

/** A new `revision` reads again and keeps the current state until the answer. */
export function useRepositoryLookup(folder: string | undefined, revision = 0): RepositoryLookupState {
  const [stored, setStored] = useState<{ folder?: string; state: RepositoryLookupState }>({ state: LOADING });

  useEffect(() => {
    if (folder === undefined) return;
    const controller = new AbortController();
    void lookup(folder, controller.signal).then((result) => {
      if (!controller.signal.aborted) setStored({ folder, state: result });
    });
    return () => controller.abort();
  }, [folder, revision]);

  return folder !== undefined && stored.folder === folder ? stored.state : LOADING;
}
