import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as releaseCheck from './release-check.js';
import { checkForUpdate, registerUpdateCheckRoute } from './update-check-route.js';

// REQ tests of plan-settings_dialog at the REST API of POST /api/update-check: a fake fetch stands in for GitHub.
vi.mock('./release-check.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./release-check.js')>();
  return { ...actual, checkLatestRelease: vi.fn(actual.checkLatestRelease) };
});

const SOURCE = 'http://127.0.0.1:9/repos/owner/name/releases/latest';
const LIST = 'http://127.0.0.1:9/repos/owner/name/releases';
const INSTALLED = '0.1.0';
const pageOf = (tag: string) => `https://github.com/owner/name/releases/tag/${tag}`;

type Answer = () => Promise<Response>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const latest = (tag: string): Answer => async () => json({ tag_name: tag, html_url: pageOf(tag) });
const listed = (...tags: string[]): Answer => async () =>
  json(tags.map((tag) => ({ tag_name: tag, html_url: pageOf(tag), body: `Notes of ${tag}`, draft: false, prerelease: false })));

/** A fake release source: `latestAnswer` for the latest release, `listAnswer` for the release list. */
function fakeSource(latestAnswer: Answer, listAnswer: Answer = listed()) {
  const source = {
    latestAnswer,
    listAnswer,
    fetch: vi.fn((input: string | URL | Request, _init?: RequestInit) => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      return url.pathname.endsWith('/latest') ? source.latestAnswer() : source.listAnswer();
    }),
    latestCalls: () => source.fetch.mock.calls.filter(([input]) => String(input).endsWith('/releases/latest')).length,
    listCalls: () => source.fetch.mock.calls.filter(([input]) => String(input).startsWith(`${LIST}?`)).length,
  };
  return source;
}

const apps: FastifyInstance[] = [];

async function routeWith(source: ReturnType<typeof fakeSource>, { sourceUrl }: { sourceUrl: string | undefined } = { sourceUrl: SOURCE }): Promise<FastifyInstance> {
  const app = Fastify();
  registerUpdateCheckRoute(app, { sourceUrl, installedVersion: INSTALLED, fetch: source.fetch as unknown as typeof fetch });
  await app.ready();
  apps.push(app);
  return app;
}

const post = (app: FastifyInstance) => app.inject({ method: 'POST', url: '/api/update-check' });

beforeEach(() => {
  vi.mocked(releaseCheck.checkLatestRelease).mockClear();
});

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

describe('POST /api/update-check', () => {
  // plan-settings_dialog/REQ-48: both versions, the release page and the changelogs of the newer releases
  it('answers 200 newer with both versions, the release page and the changelogs', async () => {
    const source = fakeSource(latest('v0.3.0'), listed('v0.3.0', 'v0.2.0', 'v0.1.0'));
    const response = await post(await routeWith(source));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'newer',
      installedVersion: INSTALLED,
      newerVersion: '0.3.0',
      releaseUrl: pageOf('v0.3.0'),
      changelogs: [
        { version: '0.3.0', text: 'Notes of v0.3.0' },
        { version: '0.2.0', text: 'Notes of v0.2.0' },
      ],
    });
  });

  // plan-settings_dialog/REQ-48: a release list that fails leaves the newer result as the check gave it
  it('answers newer with no changelogs when the release list fails', async () => {
    const source = fakeSource(latest('v0.2.0'), async () => new Response('boom', { status: 500 }));
    const response = await post(await routeWith(source));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'newer', installedVersion: INSTALLED, newerVersion: '0.2.0', releaseUrl: pageOf('v0.2.0') });
  });

  // plan-settings_dialog/REQ-47
  it.each(['v0.1.0', 'v0.0.9'])('answers 200 current with the installed version when the latest tag is %s', async (tag) => {
    const source = fakeSource(latest(tag));
    const response = await post(await routeWith(source));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'current', installedVersion: INSTALLED });
    expect(source.listCalls()).toBe(0);
  });

  // plan-settings_dialog/REQ-50: GitHub not reachable, or refusing the request
  it.each([
    ['a network error', () => Promise.reject(new TypeError('fetch failed: secret-detail'))],
    ['a 403 refusal', async () => json({ message: 'rate limited' }, 403)],
    ['a 500', async () => new Response('boom', { status: 500 })],
    ['a body that is not JSON', async () => new Response('<html>nope</html>', { status: 200 })],
  ])('answers 200 failed on %s, with no detail of the error', async (_name, answer) => {
    const source = fakeSource(answer as Answer);
    const response = await post(await routeWith(source));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'failed' });
    expect(response.body).not.toContain('secret-detail');
    expect(source.listCalls()).toBe(0);
  });

  // plan-settings_dialog/REQ-50: no source address is a failure, not "up to date"
  it('answers failed with no request when there is no source address', async () => {
    const source = fakeSource(latest('v0.2.0'));
    const response = await post(await routeWith(source, { sourceUrl: undefined }));
    expect(response.json()).toEqual({ status: 'failed' });
    expect(source.fetch).not.toHaveBeenCalled();
  });

  // spec UpdateCheckRoute: a check that throws gives failed
  it('answers failed when the check throws', async () => {
    vi.mocked(releaseCheck.checkLatestRelease).mockRejectedValueOnce(new Error('boom'));
    const response = await post(await routeWith(fakeSource(latest('v0.2.0'))));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'failed' });
  });

  // plan-settings_dialog/REQ-45: every request runs a new release check, which sees the source as it is now
  it('runs a new check for each request that comes after the previous one ended', async () => {
    const source = fakeSource(latest('v0.1.0'));
    const app = await routeWith(source);
    expect((await post(app)).json()).toEqual({ status: 'current', installedVersion: INSTALLED });
    source.latestAnswer = latest('v0.2.0');
    expect((await post(app)).json()).toMatchObject({ status: 'newer', newerVersion: '0.2.0' });
    expect(source.latestCalls()).toBe(2);
  });

  // spec UpdateCheckRoute: calls that overlap share one check
  it('gives the result of the running check to calls that arrive while it runs', async () => {
    let release!: (response: Response) => void;
    const source = fakeSource(() => new Promise<Response>((resolve) => (release = resolve)));
    const app = await routeWith(source);
    const pending = [post(app), post(app), post(app)];
    await vi.waitFor(() => expect(source.latestCalls()).toBe(1));
    await new Promise((resolve) => setTimeout(resolve, 30));
    release(json({ tag_name: 'v0.1.0', html_url: pageOf('v0.1.0') }));
    for (const response of await Promise.all(pending)) expect(response.json()).toEqual({ status: 'current', installedVersion: INSTALLED });
    expect(source.latestCalls()).toBe(1);
  });

  // plan-settings_dialog/REQ-45: the same release check as at launch, with no credentials and no user data
  it('asks the source with plain GETs carrying no credentials or cookie', async () => {
    const source = fakeSource(latest('v0.2.0'), listed('v0.2.0'));
    await post(await routeWith(source));
    expect(source.latestCalls()).toBe(1);
    expect(source.listCalls()).toBe(1);
    for (const [, init] of source.fetch.mock.calls) {
      expect((init?.method ?? 'GET').toUpperCase()).toBe('GET');
      expect(init?.body ?? undefined).toBeUndefined();
      const headers = new Headers(init?.headers);
      expect(headers.has('authorization')).toBe(false);
      expect(headers.has('cookie')).toBe(false);
    }
    expect(vi.mocked(releaseCheck.checkLatestRelease)).toHaveBeenCalledWith(expect.objectContaining({ sourceUrl: SOURCE, installedVersion: INSTALLED }));
  });
});

describe('checkForUpdate', () => {
  const run = (source: ReturnType<typeof fakeSource>) =>
    checkForUpdate({ sourceUrl: SOURCE, installedVersion: INSTALLED, fetch: source.fetch as unknown as typeof fetch });

  it('reads the release list at the address next to the source only for a newer result', async () => {
    const source = fakeSource(latest('v0.2.0'), listed('v0.2.0'));
    await expect(run(source)).resolves.toEqual({
      status: 'newer',
      installedVersion: INSTALLED,
      newerVersion: '0.2.0',
      releaseUrl: pageOf('v0.2.0'),
      changelogs: [{ version: '0.2.0', text: 'Notes of v0.2.0' }],
    });
    expect(source.listCalls()).toBe(1);
  });

  it('gives none with no changelog reading for a tag that is not newer', async () => {
    const source = fakeSource(latest('v0.1.0'));
    await expect(run(source)).resolves.toEqual({ status: 'none' });
    expect(source.listCalls()).toBe(0);
  });

  it('gives failed with no changelog reading when the source refuses', async () => {
    const source = fakeSource(async () => json({ message: 'rate limited' }, 403));
    await expect(run(source)).resolves.toEqual({ status: 'failed' });
    expect(source.listCalls()).toBe(0);
  });
});
