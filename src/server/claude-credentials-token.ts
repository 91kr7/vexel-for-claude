import { readFile } from 'node:fs/promises';
import path from 'node:path';

// The one component that opens `.credentials.json`; it takes `claudeAiOauth.accessToken` and nothing else.
export async function readAccessToken(claudeDir: string): Promise<string | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path.join(claudeDir, '.credentials.json'), 'utf8'));
    const oauth = (parsed as { claudeAiOauth?: { accessToken?: unknown } } | null)?.claudeAiOauth;
    const token = oauth?.accessToken;
    return typeof token === 'string' && token !== '' ? token : undefined;
  } catch {
    return undefined;
  }
}
