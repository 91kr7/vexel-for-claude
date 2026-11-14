import type { ReleaseChangelog } from './release-check.js';
import { newerVersionOf } from './version-rule.js';

export interface ReleaseChangelogOptions {
  listUrl: string | undefined;
  installedVersion: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

function isPublished(entry: Record<string, unknown>): boolean {
  return entry.draft !== true && entry.prerelease !== true;
}

function textOf(body: unknown): string | undefined {
  return typeof body === 'string' && body.trim() !== '' ? body : undefined;
}

export async function readReleaseChangelogs(options: ReleaseChangelogOptions): Promise<ReleaseChangelog[] | undefined> {
  if (options.listUrl === undefined) return undefined;
  const fetchPage = options.fetch ?? ((input, init) => fetch(input, init));
  const kept = new Map<string, ReleaseChangelog>();
  try {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const url = new URL(options.listUrl);
      url.searchParams.set('per_page', String(PAGE_SIZE));
      url.searchParams.set('page', String(page));
      const response = await fetchPage(url, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
      if (response.status !== 200) return undefined;
      const entries: unknown = await response.json();
      if (!Array.isArray(entries)) return undefined;
      let reachedInstalled = false;
      for (const entry of entries as unknown[]) {
        if (typeof entry !== 'object' || entry === null) continue;
        const release = entry as Record<string, unknown>;
        if (typeof release.tag_name !== 'string' || !isPublished(release)) continue;
        const version = newerVersionOf(release.tag_name, options.installedVersion);
        if (version === null) {
          reachedInstalled = true;
        } else if (!kept.has(version)) {
          const text = textOf(release.body);
          kept.set(version, text === undefined ? { version } : { version, text });
        }
      }
      if (reachedInstalled || entries.length < PAGE_SIZE) break;
    }
  } catch {
    return undefined;
  }
  return [...kept.values()].sort((a, b) => (newerVersionOf(a.version, b.version) === null ? 1 : -1));
}
