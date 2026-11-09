import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanLimitsReader } from './plan-limits-reader.js';
import { tempDir } from './test-support.js';

// Fake token and fake fetch: no test calls the real endpoint.
const TOKEN = 'fake-access-token-0123456789';
const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const GOOD_BODY = {
  limits: [
    { kind: 'session', percent: 40, resets_at: '2026-11-14T18:30:00+01:00' },
    { kind: 'weekly_all', percent: 75.4, resets_at: '2026-11-16T09:00:00+01:00' },
  ],
};

const dirs: string[] = [];
async function folderWithToken(token: string | null = TOKEN): Promise<string> {
  const dir = await tempDir('ai-client-plan-reader-');
  dirs.push(dir);
  if (token !== null) await writeFile(path.join(dir, '.credentials.json'), JSON.stringify({ claudeAiOauth: { accessToken: token } }));
  return dir;
}

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;
const fetchReturning = (...responses: Array<Response | Error>): FetchMock => {
  const mock = vi.fn<typeof fetch>();
  for (const next of responses) mock.mockImplementationOnce(() => (next instanceof Error ? Promise.reject(next) : Promise.resolve(next)));
  return mock;
};

afterEach(async () => {
  vi.restoreAllMocks();
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

describe('PlanLimitsReader', () => {
  // plan-usage_limits/REQ-13: no token -> unavailable, with no request
  it('gives unavailable with no request when there is no token', async () => {
    const fetchMock = fetchReturning();
    const reader = new PlanLimitsReader({ claudeDir: await folderWithToken(''), fetch: fetchMock });
    expect(await reader.read()).toEqual({ status: 'unavailable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gives unavailable when the credentials file is missing', async () => {
    const fetchMock = fetchReturning();
    const reader = new PlanLimitsReader({ claudeDir: await folderWithToken(null), fetch: fetchMock });
    expect(await reader.read()).toEqual({ status: 'unavailable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // plan-usage_limits/REQ-11, REQ-18: one GET to the usage endpoint with the headers of the spec
  it('makes one GET to the usage endpoint with the bearer token and the beta header', async () => {
    const fetchMock = fetchReturning(jsonResponse(GOOD_BODY));
    await new PlanLimitsReader({ claudeDir: await folderWithToken(), fetch: fetchMock }).read();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe(USAGE_URL);
    expect(init?.method ?? 'GET').toBe('GET');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
    expect(headers.get('anthropic-beta')).toBe('oauth-2025-04-20');
    expect(headers.get('accept')).toBe('application/json');
    expect(init?.redirect).toBe('error');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  // plan-usage_limits/REQ-5, REQ-6, REQ-18: a 200 gives ok with the limits of the rule
  it('gives ok with the limits of the answer on a 200', async () => {
    const fetchMock = fetchReturning(jsonResponse(GOOD_BODY));
    const result = await new PlanLimitsReader({ claudeDir: await folderWithToken(), fetch: fetchMock }).read();
    expect(result).toEqual({
      status: 'ok',
      limits: [
        { label: 'Current session', percent: 40, resetsAt: '2026-11-14T18:30:00+01:00' },
        { label: 'Current week (all models)', percent: 75, resetsAt: '2026-11-16T09:00:00+01:00' },
      ],
    });
  });

  // plan-usage_limits/REQ-14: every failure gives error
  it.each([401, 403, 429, 500, 204, 201])('gives error on the status %s', async (status) => {
    const fetchMock = fetchReturning(new Response(status === 204 ? null : JSON.stringify(GOOD_BODY), { status }));
    const result = await new PlanLimitsReader({ claudeDir: await folderWithToken(), fetch: fetchMock }).read();
    expect(result).toEqual({ status: 'error' });
  });

  it('gives error on a network error', async () => {
    const fetchMock = fetchReturning(new TypeError('fetch failed'));
    expect(await new PlanLimitsReader({ claudeDir: await folderWithToken(), fetch: fetchMock }).read()).toEqual({ status: 'error' });
  });

  it('gives error on a body that is not JSON', async () => {
    const fetchMock = fetchReturning(new Response('<html>', { status: 200 }));
    expect(await new PlanLimitsReader({ claudeDir: await folderWithToken(), fetch: fetchMock }).read()).toEqual({ status: 'error' });
  });

  it.each([{}, { limits: [] }, { five_hour: null }, []])('gives error on a 200 with no limit at all (%j)', async (body) => {
    const fetchMock = fetchReturning(jsonResponse(body));
    expect(await new PlanLimitsReader({ claudeDir: await folderWithToken(), fetch: fetchMock }).read()).toEqual({ status: 'error' });
  });

  // spec: limit timeoutMs, then error
  it('gives error when the request outlasts timeoutMs', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    const reader = new PlanLimitsReader({ claudeDir: await folderWithToken(), fetch: fetchMock, timeoutMs: 30 });
    expect(await reader.read()).toEqual({ status: 'error' });
  });

  // spec: never rejects
  it('never rejects, even when fetch throws at once', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => {
      throw new Error('boom');
    });
    await expect(new PlanLimitsReader({ claudeDir: await folderWithToken(), fetch: fetchMock }).read()).resolves.toEqual({ status: 'error' });
  });

  // spec: the token is never logged, never in the result or in an error
  it.each([
    ['a good answer', () => jsonResponse(GOOD_BODY)],
    ['a 401', () => jsonResponse({ error: TOKEN }, 401)],
    ['a network error that names the token', () => new TypeError(`bad ${TOKEN}`)],
  ])('never logs the token or puts it in the result: %s', async (_name, next) => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) => vi.spyOn(console, method).mockImplementation(() => {}));
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const result = await new PlanLimitsReader({ claudeDir: await folderWithToken(), fetch: fetchReturning(next()) }).read();
    const written = [...spies, stdout, stderr].flatMap((spy) => spy.mock.calls.map((call) => String(call.join(' ')))).join('\n');
    expect(written).not.toContain(TOKEN);
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });
});
