import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkForUpdates } from './update-check-client';

// Unit tests of the page call of the update check, plan-settings_dialog/REQ-45, REQ-50: a fake fetch stands in for the route.
const NEWER = {
  status: 'newer',
  installedVersion: '0.1.0',
  newerVersion: '0.2.0',
  releaseUrl: 'https://github.com/owner/name/releases/tag/v0.2.0',
};

let answer: () => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn>;

const reply = (body: unknown, status = 200) => () => Promise.resolve(new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  answer = reply({ status: 'current', installedVersion: '0.1.0' });
  fetchMock = vi.fn((_url: string, _init?: RequestInit) => answer());
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('checkForUpdates', () => {
  // plan-settings_dialog/REQ-45: one POST to the update check route
  it('sends one POST to /api/update-check with the given signal', async () => {
    const controller = new AbortController();
    await checkForUpdates(controller.signal);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined];
    expect(url).toBe('/api/update-check');
    expect(init?.method?.toUpperCase()).toBe('POST');
    expect(init?.signal).toBe(controller.signal);
  });

  it('gives current with the installed version of the answer', async () => {
    answer = reply({ status: 'current', installedVersion: '0.6.1' });
    await expect(checkForUpdates()).resolves.toEqual({ status: 'current', installedVersion: '0.6.1' });
  });

  it('gives newer with the NewerVersion of the answer', async () => {
    answer = reply(NEWER);
    await expect(checkForUpdates()).resolves.toEqual({
      status: 'newer',
      version: { installedVersion: '0.1.0', newerVersion: '0.2.0', releaseUrl: NEWER.releaseUrl },
    });
  });

  it('keeps well-formed changelogs in the order of the answer', async () => {
    const changelogs = [{ version: '0.3.0', text: 'Third' }, { version: '0.2.0' }];
    answer = reply({ ...NEWER, newerVersion: '0.3.0', changelogs });
    await expect(checkForUpdates()).resolves.toEqual({
      status: 'newer',
      version: { installedVersion: '0.1.0', newerVersion: '0.3.0', releaseUrl: NEWER.releaseUrl, changelogs },
    });
  });

  it('drops malformed changelogs and still gives newer', async () => {
    answer = reply({ ...NEWER, changelogs: [{ version: '0.2.0', text: 'Fine' }, { version: 2 }] });
    const result = await checkForUpdates();
    expect(result.status).toBe('newer');
    expect(result.status === 'newer' && result.version.changelogs).toBeFalsy();
  });

  // plan-settings_dialog/REQ-50
  it.each([
    ['a failed answer', reply({ status: 'failed' })],
    ['a network error', () => Promise.reject(new TypeError('fetch failed'))],
    ['an abort', () => Promise.reject(new DOMException('aborted', 'AbortError'))],
    ['a 403', reply({ error: 'forbidden' }, 403)],
    ['a 500 with a current body', reply({ status: 'current', installedVersion: '0.1.0' }, 500)],
    ['a body that is not JSON', () => Promise.resolve(new Response('<html>nope</html>', { status: 200 }))],
    ['a JSON null', reply(null)],
    ['an unknown status', reply({ status: 'none' })],
    ['current with no installed version', reply({ status: 'current' })],
    ['current with an empty installed version', reply({ status: 'current', installedVersion: '' })],
    ['current with a numeric installed version', reply({ status: 'current', installedVersion: 1 })],
    ['newer with no release page', reply({ status: 'newer', installedVersion: '0.1.0', newerVersion: '0.2.0' })],
    ['newer with a numeric version', reply({ ...NEWER, newerVersion: 2 })],
  ])('gives failed on %s, without rejecting', async (_name, next) => {
    answer = next as () => Promise<Response>;
    await expect(checkForUpdates()).resolves.toEqual({ status: 'failed' });
  });

  it('gives failed when fetch throws synchronously', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('boom');
      }),
    );
    await expect(checkForUpdates()).resolves.toEqual({ status: 'failed' });
  });
});
