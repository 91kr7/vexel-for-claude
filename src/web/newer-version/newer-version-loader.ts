import { useEffect, useState } from 'react';

export interface NewerVersion {
  installedVersion: string;
  newerVersion: string;
  releaseUrl: string;
}

async function loadNewerVersion(signal: AbortSignal): Promise<NewerVersion | null> {
  try {
    const response = await fetch('/api/newer-version', { signal });
    if (response.status !== 200) return null;
    const body = (await response.json()) as Record<string, unknown> | null;
    if (body?.status !== 'newer') return null;
    const { installedVersion, newerVersion, releaseUrl } = body;
    if (typeof installedVersion !== 'string' || typeof newerVersion !== 'string' || typeof releaseUrl !== 'string') return null;
    return { installedVersion, newerVersion, releaseUrl };
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
