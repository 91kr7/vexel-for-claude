import { useEffect, useState } from 'react';

async function loadInstalledVersion(signal: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch('/api/installed-version', { signal });
    if (response.status !== 200) return null;
    const body = (await response.json()) as Record<string, unknown> | null;
    const version = body?.version;
    return typeof version === 'string' && version !== '' ? version : null;
  } catch {
    return null;
  }
}

export function useInstalledVersion(): string | null {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void loadInstalledVersion(controller.signal).then((loaded) => {
      if (!controller.signal.aborted) setVersion(loaded);
    });
    return () => controller.abort();
  }, []);

  return version;
}
