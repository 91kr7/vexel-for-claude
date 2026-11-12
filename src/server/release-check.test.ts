import { describe, expect, it, vi } from 'vitest';
import { checkLatestRelease, latestReleaseApiUrl } from './release-check.js';

// Unit tests of the release check, plan-update_check/REQ-1, REQ-3, REQ-9, REQ-12: a fake fetch stands in for GitHub.
const SOURCE = 'http://127.0.0.1:9/repos/owner/name/releases/latest';
const RELEASE_PAGE = 'https://github.com/owner/name/releases/tag/v0.2.0';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function fakeFetch(answer: () => Promise<Response>) {
  return vi.fn((_input: string | URL | Request, _init?: RequestInit) => answer());
}

const check = (fetch: ReturnType<typeof fakeFetch>, installedVersion = '0.1.0', timeoutMs?: number) =>
  checkLatestRelease({ sourceUrl: SOURCE, installedVersion, fetch: fetch as unknown as typeof globalThis.fetch, timeoutMs });

describe('latestReleaseApiUrl', () => {
  it.each([
    'git+https://github.com/owner/name.git',
    'https://github.com/owner/name',
    'https://github.com/owner/name.git',
    'git+https://github.com/owner/name',
  ])('maps the GitHub repository %s to the latest release endpoint', (url) => {
    expect(latestReleaseApiUrl(url)).toBe('https://api.github.com/repos/owner/name/releases/latest');
  });

  it.each(['https://gitlab.com/owner/name.git', 'git@github.com:owner/name.git', 'https://github.com/owner', '', 'not an address'])(
    'gives undefined for %j',
    (url) => {
      expect(latestReleaseApiUrl(url)).toBeUndefined();
    },
  );
});

describe('checkLatestRelease', () => {
  // plan-update_check/REQ-1, REQ-4
  it('gives newer with both versions and the release page for a higher tag', async () => {
    const fetch = fakeFetch(async () => json({ tag_name: 'v0.2.0', html_url: RELEASE_PAGE }));
    await expect(check(fetch)).resolves.toEqual({ status: 'newer', installedVersion: '0.1.0', newerVersion: '0.2.0', releaseUrl: RELEASE_PAGE });
  });

  // plan-update_check/REQ-1, REQ-12: one plain GET to the source, with the GitHub accept header and nothing about the user
  it('sends one GET to the source address with no credentials, cookie or user data', async () => {
    const fetch = fakeFetch(async () => json({ tag_name: 'v0.2.0', html_url: RELEASE_PAGE }));
    await check(fetch);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [input, init] = fetch.mock.calls[0]!;
    expect(String(input instanceof Request ? input.url : input)).toBe(SOURCE);
    expect((init?.method ?? 'GET').toUpperCase()).toBe('GET');
    expect(init?.body ?? undefined).toBeUndefined();
    const headers = new Headers(init?.headers);
    expect(headers.get('accept')).toBe('application/vnd.github+json');
    expect(headers.has('authorization')).toBe(false);
    expect(headers.has('cookie')).toBe(false);
    expect(init?.credentials === undefined || init.credentials === 'omit').toBe(true);
  });

  it('gives none with no request when the source address is undefined', async () => {
    const fetch = fakeFetch(async () => json({ tag_name: 'v0.2.0', html_url: RELEASE_PAGE }));
    await expect(
      checkLatestRelease({ sourceUrl: undefined, installedVersion: '0.1.0', fetch: fetch as unknown as typeof globalThis.fetch }),
    ).resolves.toEqual({ status: 'none' });
    expect(fetch).not.toHaveBeenCalled();
  });

  // plan-update_check/REQ-3, REQ-4
  it.each(['v0.1.0', 'v0.0.9', 'v0.2.0-rc.1', 'nightly'])('gives none for the tag %s, which is not newer', async (tag) => {
    const fetch = fakeFetch(async () => json({ tag_name: tag, html_url: RELEASE_PAGE }));
    await expect(check(fetch)).resolves.toEqual({ status: 'none' });
  });

  // plan-update_check/REQ-9
  it.each([
    ['a network error', () => Promise.reject(new TypeError('fetch failed'))],
    ['a 403 refusal', async () => json({ message: 'rate limited' }, 403)],
    ['a 404', async () => json({ message: 'Not Found' }, 404)],
    ['a 500', async () => new Response('boom', { status: 500 })],
    ['a 204 with no body', async () => new Response(null, { status: 204 })],
    ['a body that is not JSON', async () => new Response('<html>nope</html>', { status: 200 })],
    ['a JSON body without tag_name', async () => json({ html_url: RELEASE_PAGE })],
    ['a JSON body without html_url', async () => json({ tag_name: 'v0.2.0' })],
    ['an html_url that is not an address', async () => json({ tag_name: 'v0.2.0', html_url: 'release page' })],
    ['an html_url with another scheme', async () => json({ tag_name: 'v0.2.0', html_url: 'javascript:alert(1)' })],
    ['an html_url with the file scheme', async () => json({ tag_name: 'v0.2.0', html_url: 'file:///etc/passwd' })],
    ['a tag_name that is not text', async () => json({ tag_name: 2, html_url: RELEASE_PAGE })],
    ['a JSON array', async () => json([{ tag_name: 'v0.2.0', html_url: RELEASE_PAGE }])],
    ['a JSON null', async () => json(null)],
  ])('gives none on %s, without rejecting', async (_name, answer) => {
    const fetch = fakeFetch(answer as () => Promise<Response>);
    await expect(check(fetch)).resolves.toEqual({ status: 'none' });
  });

  it('accepts an http release page address', async () => {
    const page = 'http://127.0.0.1:9/release/v0.2.0';
    const fetch = fakeFetch(async () => json({ tag_name: 'v0.2.0', html_url: page }));
    await expect(check(fetch)).resolves.toMatchObject({ status: 'newer', releaseUrl: page });
  });

  it('gives none when fetch throws synchronously', async () => {
    const fetch = vi.fn(() => {
      throw new Error('boom');
    });
    await expect(check(fetch as unknown as ReturnType<typeof fakeFetch>)).resolves.toEqual({ status: 'none' });
  });

  // plan-update_check/REQ-9: a source that never answers gives none once the limit passes, and the request is aborted
  it('gives none and aborts the request when the source does not answer within the limit', async () => {
    let signal: AbortSignal | undefined;
    const fetch = vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason ?? new Error('aborted')));
      });
    });
    const started = Date.now();
    await expect(check(fetch, '0.1.0', 50)).resolves.toEqual({ status: 'none' });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(signal?.aborted).toBe(true);
  });

  it('gives none when the body does not arrive within the limit', async () => {
    const fetch = vi.fn((_input: string | URL | Request, init?: RequestInit) =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
        text: () =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      } as unknown as Response),
    );
    await expect(check(fetch, '0.1.0', 50)).resolves.toEqual({ status: 'none' });
  });

  it('logs no error on a failure', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await check(fakeFetch(() => Promise.reject(new TypeError('fetch failed'))));
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });
});
