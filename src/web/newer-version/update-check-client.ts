import { type NewerVersion, newerVersionOfBody } from './newer-version-loader';

export type UpdateCheckResult =
  | { status: 'newer'; version: NewerVersion }
  | { status: 'current'; installedVersion: string }
  | { status: 'failed' };

const FAILED: UpdateCheckResult = { status: 'failed' };

export async function checkForUpdates(signal?: AbortSignal): Promise<UpdateCheckResult> {
  try {
    const response = await fetch('/api/update-check', { method: 'POST', signal });
    if (response.status !== 200) return FAILED;
    const body = (await response.json()) as Record<string, unknown> | null;
    if (body?.status === 'current') {
      const { installedVersion } = body;
      return typeof installedVersion === 'string' && installedVersion !== '' ? { status: 'current', installedVersion } : FAILED;
    }
    const version = newerVersionOfBody(body);
    return version ? { status: 'newer', version } : FAILED;
  } catch {
    return FAILED;
  }
}
