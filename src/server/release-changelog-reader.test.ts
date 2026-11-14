import { describe, expect, it, vi } from 'vitest';
import { readReleaseChangelogs } from './release-changelog-reader.js';

// Unit tests of the release changelog reader, plan-release_changelog/REQ-7, REQ-8, REQ-13, REQ-17: a fake fetch stands in for GitHub.
const LIST = 'http://127.0.0.1:9/repos/owner/name/releases';

interface Release {
  tag_name?: unknown;
  body?: unknown;
  draft?: boolean;
  prerelease?: boolean;
}

const release = (tag: string, body: unknown = `notes of ${tag}`, extra: Partial<Release> = {}): Release => ({
  tag_name: tag,
  body,
  draft: false,
  prerelease: false,
  ...extra,
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Answers page `n` (1-based) with `pages[n - 1]`; a missing page is an empty list. */
function pagedFetch(pages: Array<unknown[] | (() => Promise<Response>)>) {
  return vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    const page = Number(url.searchParams.get('page'));
    const answer = pages[page - 1] ?? [];
    return typeof answer === 'function' ? answer() : json(answer);
  });
}

const read = (fetch: ReturnType<typeof vi.fn>, installedVersion = '0.4.0', timeoutMs?: number) =>
  readReleaseChangelogs({ listUrl: LIST, installedVersion, fetch: fetch as unknown as typeof globalThis.fetch, timeoutMs });

/** A full page of 100 published releases, all newer than 0.4.0: 1.<start + i>.0. */
const fullNewerPage = (start: number) => Array.from({ length: 100 }, (_, i) => release(`v1.${start + i}.0`));

describe('readReleaseChangelogs', () => {
  // plan-release_changelog/REQ-7
  it('keeps the published releases newer than the installed version, with their description', async () => {
    const fetch = pagedFetch([[release('v0.6.0', 'six'), release('v0.5.0', 'five'), release('v0.4.0', 'four'), release('v0.3.0', 'three')]]);
    await expect(read(fetch)).resolves.toEqual([
      { version: '0.6.0', text: 'six' },
      { version: '0.5.0', text: 'five' },
    ]);
  });

  // plan-release_changelog/REQ-7
  it('leaves out drafts and pre-releases', async () => {
    const fetch = pagedFetch([
      [
        release('v0.8.0', 'draft', { draft: true }),
        release('v0.7.0', 'pre', { prerelease: true }),
        release('v0.7.0-rc.1', 'rc', { prerelease: true }),
        release('v0.6.0', 'six'),
      ],
    ]);
    await expect(read(fetch)).resolves.toEqual([{ version: '0.6.0', text: 'six' }]);
  });

  // plan-release_changelog/REQ-8
  it('orders the releases by version, newest first, whatever the order of the answer', async () => {
    const fetch = pagedFetch([[release('v0.5.0'), release('v0.10.0'), release('v0.6.0'), release('v1.0.0'), release('v0.4.0')]]);
    const result = await read(fetch);
    expect(result?.map((entry) => entry.version)).toEqual(['1.0.0', '0.10.0', '0.6.0', '0.5.0']);
  });

  // plan-release_changelog/REQ-13
  it.each([
    ['empty', ''],
    ['blank', '  \n\t '],
    ['null', null],
    ['missing', undefined],
    ['not text', 42],
  ])('gives a release with a %s description its version and no text', async (_name, body) => {
    const fetch = pagedFetch([[release('v0.6.0', 'six'), { tag_name: 'v0.5.0', body, draft: false, prerelease: false }]]);
    const result = await read(fetch);
    expect(result).toEqual([{ version: '0.6.0', text: 'six' }, { version: '0.5.0' }]);
    expect(result?.[1]).not.toHaveProperty('text');
  });

  it('keeps one entry per version when two tags name the same version', async () => {
    const fetch = pagedFetch([[release('v0.5.0', 'first'), release('0.5.0', 'second')]]);
    await expect(read(fetch)).resolves.toEqual([{ version: '0.5.0', text: 'first' }]);
  });

  it('gives an empty list when no release is newer', async () => {
    const fetch = pagedFetch([[release('v0.4.0'), release('v0.3.0')]]);
    await expect(read(fetch)).resolves.toEqual([]);
  });

  it('skips entries that are not objects or have no text tag', async () => {
    const fetch = pagedFetch([[null, 'v0.9.0', 7, { body: 'no tag' }, { tag_name: 5, body: 'number tag' }, release('v0.5.0', 'five')]]);
    await expect(read(fetch)).resolves.toEqual([{ version: '0.5.0', text: 'five' }]);
  });

  it('gives undefined with no request when the list address is undefined', async () => {
    const fetch = pagedFetch([[release('v0.5.0')]]);
    await expect(
      readReleaseChangelogs({ listUrl: undefined, installedVersion: '0.4.0', fetch: fetch as unknown as typeof globalThis.fetch }),
    ).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  // plan-release_changelog/REQ-17: a plain GET with the GitHub accept header and nothing about the user
  it('asks page 1 of 100 with a plain GET, no credentials and no user data', async () => {
    const fetch = pagedFetch([[release('v0.5.0')]]);
    await read(fetch);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [input, init] = fetch.mock.calls[0]!;
    const url = new URL(String(input instanceof Request ? input.url : input));
    expect(`${url.origin}${url.pathname}`).toBe(LIST);
    expect(Object.fromEntries(url.searchParams)).toEqual({ per_page: '100', page: '1' });
    expect((init?.method ?? 'GET').toUpperCase()).toBe('GET');
    expect(init?.body ?? undefined).toBeUndefined();
    const headers = new Headers(init?.headers);
    expect(headers.get('accept')).toBe('application/vnd.github+json');
    expect(headers.has('authorization')).toBe(false);
    expect(headers.has('cookie')).toBe(false);
    expect(init?.credentials === undefined || init.credentials === 'omit').toBe(true);
    const user = process.env.USER ?? process.env.LOGNAME;
    if (user) expect(JSON.stringify([String(input), [...headers]])).not.toContain(user);
  });

  it('reads the next page while each page is full of newer releases, and merges them newest first', async () => {
    const fetch = pagedFetch([fullNewerPage(0), [release('v0.5.0', 'five')]]);
    const result = await read(fetch);
    expect(fetch).toHaveBeenCalledTimes(2);
    const pages = fetch.mock.calls.map(([input]) => new URL(String(input)).searchParams.get('page'));
    expect(pages).toEqual(['1', '2']);
    expect(result).toHaveLength(101);
    expect(result?.[0]?.version).toBe('1.99.0');
    expect(result?.at(-1)).toEqual({ version: '0.5.0', text: 'five' });
  });

  it('stops at a short page', async () => {
    const fetch = pagedFetch([[release('v0.5.0')], fullNewerPage(0)]);
    await read(fetch);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('stops at a full page that holds a published release not newer than the installed version', async () => {
    const page = [...fullNewerPage(0).slice(0, 99), release('v0.4.0')];
    const fetch = pagedFetch([page, fullNewerPage(200)]);
    const result = await read(fetch);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(99);
  });

  it('goes on past a full page whose only older releases are drafts or pre-releases', async () => {
    const page = [...fullNewerPage(0).slice(0, 98), release('v0.3.0', 'd', { draft: true }), release('v0.2.0', 'p', { prerelease: true })];
    const fetch = pagedFetch([page, [release('v0.5.0')]]);
    await read(fetch);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('asks at most 10 pages', async () => {
    const fetch = pagedFetch(Array.from({ length: 12 }, (_, i) => fullNewerPage(i * 100)));
    const result = await read(fetch);
    expect(fetch).toHaveBeenCalledTimes(10);
    expect(result).toHaveLength(1000);
  });

  // plan-release_changelog/REQ-14: any failure gives no changelogs, never a rejection
  it.each([
    ['a status other than 200', async () => json([], 500)],
    ['a 404', async () => json({ message: 'Not Found' }, 404)],
    ['a body that is not JSON', async () => new Response('<html>', { status: 200 })],
    ['a body that is not a list', async () => json({ tag_name: 'v0.5.0' })],
    ['a network error', async () => Promise.reject(new TypeError('fetch failed'))],
  ])('gives undefined on %s', async (_name, answer) => {
    const fetch = pagedFetch([answer]);
    await expect(read(fetch)).resolves.toBeUndefined();
  });

  it('gives undefined when fetch throws synchronously', async () => {
    const fetch = vi.fn(() => {
      throw new Error('boom');
    });
    await expect(read(fetch)).resolves.toBeUndefined();
  });

  it('gives undefined when a later page fails, even after a good first page', async () => {
    const fetch = pagedFetch([fullNewerPage(0), async () => json([], 503)]);
    await expect(read(fetch)).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('gives undefined and aborts the request when a page does not answer within the limit', async () => {
    const signals: AbortSignal[] = [];
    const fetch = vi.fn(
      (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          if (init?.signal) {
            signals.push(init.signal);
            init.signal.addEventListener('abort', () => reject(init.signal!.reason));
          }
        }),
    );
    const started = Date.now();
    await expect(read(fetch, '0.4.0', 50)).resolves.toBeUndefined();
    expect(Date.now() - started).toBeLessThan(2000);
    expect(signals).toHaveLength(1);
    expect(signals[0]!.aborted).toBe(true);
  });

  it('logs no error on a failure', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await read(pagedFetch([async () => json([], 500)]));
      await read(pagedFetch([async () => Promise.reject(new TypeError('fetch failed'))]));
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });
});
