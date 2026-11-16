import { newerVersionOf } from './version-rule.js';

/** `text` is absent when the release has no description. */
export interface ReleaseChangelog {
  version: string;
  text?: string;
}

export type ReleaseCheckResult =
  | { status: 'newer'; installedVersion: string; newerVersion: string; releaseUrl: string; changelogs?: ReleaseChangelog[] }
  | { status: 'none' }
  | { status: 'failed' };

export interface ReleaseCheckOptions {
  sourceUrl: string | undefined;
  installedVersion: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const NONE: ReleaseCheckResult = { status: 'none' };
const FAILED: ReleaseCheckResult = { status: 'failed' };
const GITHUB_REPOSITORY = /^(?:git\+)?https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/;

export function latestReleaseApiUrl(repositoryUrl: string): string | undefined {
  const match = GITHUB_REPOSITORY.exec(repositoryUrl);
  return match ? `https://api.github.com/repos/${match[1]}/${match[2]}/releases/latest` : undefined;
}

export function releaseListUrl(sourceUrl: string | undefined): string | undefined {
  return sourceUrl?.endsWith('/latest') ? sourceUrl.slice(0, -'/latest'.length) : undefined;
}

function isWebAddress(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export async function checkLatestRelease(options: ReleaseCheckOptions): Promise<ReleaseCheckResult> {
  if (options.sourceUrl === undefined) return FAILED;
  const fetchRelease = options.fetch ?? ((input, init) => fetch(input, init));
  try {
    const response = await fetchRelease(options.sourceUrl, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (response.status !== 200) return FAILED;
    const body = (await response.json()) as { tag_name?: unknown; html_url?: unknown } | null;
    if (typeof body?.tag_name !== 'string' || !isWebAddress(body.html_url)) return FAILED;
    const newerVersion = newerVersionOf(body.tag_name, options.installedVersion);
    return newerVersion === null
      ? NONE
      : { status: 'newer', installedVersion: options.installedVersion, newerVersion, releaseUrl: body.html_url };
  } catch {
    return FAILED;
  }
}
