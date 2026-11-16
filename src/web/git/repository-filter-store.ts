import { useCallback, useEffect, useMemo, useState } from 'react';

export interface RepositoryFilter {
  /** Chosen roots, all covered; empty means no filter. */
  chosen: readonly string[];
  /** Adds the root to the choice, or removes it. */
  toggle: (root: string) => void;
  /** Empties the choice. */
  clear: () => void;
}

const NONE: readonly string[] = [];

// In memory only: the choice lasts while the page stays open.
const chosenByFolder = new Map<string, readonly string[]>();

/** The repository choice of a project folder, kept for the life of the page. Without a folder it lives only in the caller. */
export function useRepositoryFilter(folder: string | undefined, roots: readonly string[]): RepositoryFilter {
  const [local, setLocal] = useState<readonly string[]>(NONE);
  const [, setVersion] = useState(0);
  const saved = folder === undefined ? local : (chosenByFolder.get(folder) ?? NONE);
  // No covered roots means the lookup has no answer yet: keep the choice as it is.
  const pruned = useMemo(() => (roots.length === 0 ? saved : saved.filter((root) => roots.includes(root))), [saved, roots]);

  const save = useCallback(
    (next: readonly string[]) => {
      if (folder === undefined) {
        setLocal(next);
        return;
      }
      if (next.length > 0) chosenByFolder.set(folder, next);
      else chosenByFolder.delete(folder);
      setVersion((current) => current + 1);
    },
    [folder],
  );

  useEffect(() => {
    if (pruned.length !== saved.length) save(pruned);
  }, [pruned, saved, save]);

  const chosen = roots.length < 2 ? NONE : pruned;
  const toggle = useCallback(
    (root: string) => save(chosen.includes(root) ? chosen.filter((entry) => entry !== root) : [...chosen, root]),
    [chosen, save],
  );
  const clear = useCallback(() => save(NONE), [save]);
  return { chosen, toggle, clear };
}
