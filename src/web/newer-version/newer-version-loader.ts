import { useEffect, useState } from 'react';

/** `text` is absent when the release has no description. */
export interface ReleaseChangelog {
  version: string;
  text?: string;
}

export interface NewerVersion {
  installedVersion: string;
  newerVersion: string;
  releaseUrl: string;
  changelogs?: ReleaseChangelog[];
}

function changelogsOf(value: unknown): ReleaseChangelog[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const changelogs: ReleaseChangelog[] = [];
  for (const entry of value as unknown[]) {
    if (typeof entry !== 'object' || entry === null) return undefined;
    const { version, text } = entry as Record<string, unknown>;
    if (typeof version !== 'string' || (text !== undefined && typeof text !== 'string')) return undefined;
    changelogs.push(text ? { version, text } : { version });
  }
  return changelogs;
}

async function loadNewerVersion(signal: AbortSignal): Promise<NewerVersion | null> {
  try {
    const response = await fetch('/api/newer-version', { signal });
    if (response.status !== 200) return null;
    const body = (await response.json()) as Record<string, unknown> | null;
    if (body?.status !== 'newer') return null;
    const { installedVersion, newerVersion, releaseUrl } = body;
    if (typeof installedVersion !== 'string' || typeof newerVersion !== 'string' || typeof releaseUrl !== 'string') return null;
    const changelogs = changelogsOf(body.changelogs);
    return changelogs ? { installedVersion, newerVersion, releaseUrl, changelogs } : { installedVersion, newerVersion, releaseUrl };
  } catch {
    return null;
  }
}

export function useNewerVersion(): NewerVersion | null {
  const [version, setVersion] = useState<NewerVersion | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void loadNewerVersion(controller.signal).then((loaded) => {
      if (!controller.signal.aborted) setVersion(loaded);
    });
    return () => controller.abort();
  }, []);

  return version;
}
