import type { FastifyInstance } from 'fastify';
import { readReleaseChangelogs } from './release-changelog-reader.js';
import { checkLatestRelease, releaseListUrl, type ReleaseCheckResult } from './release-check.js';

export interface UpdateCheckOptions {
  sourceUrl: string | undefined;
  installedVersion: string;
  fetch?: typeof fetch;
}

export type UpdateCheckAnswer =
  | Extract<ReleaseCheckResult, { status: 'newer' }>
  | { status: 'current'; installedVersion: string }
  | { status: 'failed' };

export async function checkForUpdate(options: UpdateCheckOptions): Promise<ReleaseCheckResult> {
  const result = await checkLatestRelease(options);
  if (result.status !== 'newer') return result;
  const changelogs = await readReleaseChangelogs({
    listUrl: releaseListUrl(options.sourceUrl),
    installedVersion: options.installedVersion,
    fetch: options.fetch,
  });
  return changelogs === undefined ? result : { ...result, changelogs };
}

export function registerUpdateCheckRoute(app: FastifyInstance, options: UpdateCheckOptions): void {
  let inFlight: Promise<UpdateCheckAnswer> | undefined;
  const checkShared = (): Promise<UpdateCheckAnswer> => {
    inFlight ??= checkForUpdate(options)
      .then((result): UpdateCheckAnswer =>
        result.status === 'none' ? { status: 'current', installedVersion: options.installedVersion } : result,
      )
      .catch((): UpdateCheckAnswer => ({ status: 'failed' }))
      .finally(() => {
        inFlight = undefined;
      });
    return inFlight;
  };
  app.post('/api/update-check', async () => checkShared());
}
