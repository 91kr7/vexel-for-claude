import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readAccessToken } from './claude-credentials-token.js';
import { snapshotTree, tempDir } from './test-support.js';

// The values below are fake: no test holds a real token.
const dirs: string[] = [];
async function folderWith(content?: string): Promise<string> {
  const dir = await tempDir('ai-client-credentials-');
  dirs.push(dir);
  if (content !== undefined) await writeFile(path.join(dir, '.credentials.json'), content);
  return dir;
}

afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

describe('readAccessToken', () => {
  // plan-usage_limits/REQ-13, REQ-18: gives claudeAiOauth.accessToken
  it('gives claudeAiOauth.accessToken', async () => {
    const dir = await folderWith(JSON.stringify({ claudeAiOauth: { accessToken: 'fake-access', refreshToken: 'fake-refresh' } }));
    expect(await readAccessToken(dir)).toBe('fake-access');
  });

  // spec: only the access token, never the refresh token or mcpOAuth
  it('does not take the refresh token or the mcpOAuth tokens when there is no access token', async () => {
    const dir = await folderWith(
      JSON.stringify({ claudeAiOauth: { refreshToken: 'fake-refresh' }, mcpOAuth: { server: { accessToken: 'fake-mcp' } }, accessToken: 'fake-top' }),
    );
    expect(await readAccessToken(dir)).toBeUndefined();
  });

  // spec: missing file, bad JSON, no claudeAiOauth, a token that is not a non-empty text -> undefined, never throws
  it('gives undefined when the file is missing', async () => {
    expect(await readAccessToken(await folderWith())).toBeUndefined();
  });

  it('gives undefined when the folder does not exist', async () => {
    expect(await readAccessToken(path.join(await folderWith(), 'absent'))).toBeUndefined();
  });

  it('gives undefined when the path is a directory', async () => {
    const dir = await folderWith();
    await mkdir(path.join(dir, '.credentials.json'));
    expect(await readAccessToken(dir)).toBeUndefined();
  });

  it.each([
    ['bad JSON', '{not json'],
    ['empty file', ''],
    ['null', 'null'],
    ['an array', '[]'],
    ['no claudeAiOauth', '{}'],
    ['claudeAiOauth null', '{"claudeAiOauth":null}'],
    ['no accessToken', '{"claudeAiOauth":{}}'],
    ['an empty token', '{"claudeAiOauth":{"accessToken":""}}'],
    ['a numeric token', '{"claudeAiOauth":{"accessToken":12}}'],
    ['a null token', '{"claudeAiOauth":{"accessToken":null}}'],
  ])('gives undefined for %s', async (_name, content) => {
    expect(await readAccessToken(await folderWith(content))).toBeUndefined();
  });

  it('gives undefined when the file is unreadable', async (context) => {
    if (process.getuid?.() === 0) context.skip();
    const dir = await folderWith('{"claudeAiOauth":{"accessToken":"fake-access"}}');
    await chmod(path.join(dir, '.credentials.json'), 0o000);
    expect(await readAccessToken(dir)).toBeUndefined();
  });

  // spec: read-only; it opens no other file
  it('changes nothing in the folder', async () => {
    const dir = await folderWith(JSON.stringify({ claudeAiOauth: { accessToken: 'fake-access' } }));
    await writeFile(path.join(dir, '123.abc.key'), 'fake-key');
    const before = await snapshotTree(dir);
    await readAccessToken(dir);
    expect(await snapshotTree(dir)).toEqual(before);
  });
});
