import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadProcesses } from './processes-client';

// Unit tests of loadProcesses, plan-app_processes/REQ-10, REQ-11: a fake fetch stands in for GET /api/processes.
const SERVER = { kind: 'app-server', pid: 10, startedAt: 1000, port: 4001, thisInstance: true, hosted: false, hanging: false };
const SESSION = { kind: 'claude-session', pid: 20, startedAt: 2000, folder: '/home/me/project', label: 'Fix bug', thisInstance: false, hosted: true, hanging: false };

let calls: Array<{ url: string; init?: RequestInit }>;

function answer(response: () => Promise<Response>) {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return response();
    }),
  );
}

const json = (body: unknown, status = 200) => () => Promise.resolve(new Response(JSON.stringify(body), { status }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadProcesses', () => {
  it('makes one GET /api/processes call', async () => {
    answer(json({ processes: [] }));
    await loadProcesses();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('/api/processes');
    expect(calls[0]?.init?.method ?? 'GET').toBe('GET');
  });

  it('gives the valid rows of a 200 answer, in the same order', async () => {
    answer(json({ processes: [SERVER, SESSION] }));
    expect(await loadProcesses()).toEqual({ status: 'loaded', processes: [SERVER, SESSION] });
  });

  it('gives an empty list as loaded', async () => {
    answer(json({ processes: [] }));
    expect(await loadProcesses()).toEqual({ status: 'loaded', processes: [] });
  });

  it.each(['app-server', 'test-server', 'fake-claude', 'claude-session'])('accepts the kind "%s"', async (kind) => {
    answer(json({ processes: [{ ...SERVER, kind }] }));
    expect((await loadProcesses()).status).toBe('loaded');
  });

  it('fails on a network error, without rejecting', async () => {
    answer(() => Promise.reject(new TypeError('network down')));
    expect(await loadProcesses()).toEqual({ status: 'failed' });
  });

  it.each([404, 500, 201])('fails on the status %s', async (status) => {
    answer(json({ processes: [] }, status));
    expect(await loadProcesses()).toEqual({ status: 'failed' });
  });

  it('fails on a body that is not JSON', async () => {
    answer(() => Promise.resolve(new Response('not json', { status: 200 })));
    expect(await loadProcesses()).toEqual({ status: 'failed' });
  });

  it.each([
    ['no processes field', {}],
    ['processes not a list', { processes: 'none' }],
    ['an unknown kind', { processes: [SERVER, { ...SESSION, kind: 'browser' }] }],
    ['a pid that is text', { processes: [{ ...SERVER, pid: '10' }] }],
    ['a missing startedAt', { processes: [{ ...SERVER, startedAt: undefined }] }],
    ['thisInstance not a boolean', { processes: [{ ...SERVER, thisInstance: 'yes' }] }],
    ['hosted missing', { processes: [{ ...SERVER, hosted: undefined }] }],
    ['hanging not a boolean', { processes: [{ ...SERVER, hanging: 1 }] }],
    ['a port that is text', { processes: [{ ...SERVER, port: '4001' }] }],
    ['a folder that is a number', { processes: [{ ...SESSION, folder: 5 }] }],
    ['a label that is a number', { processes: [{ ...SESSION, label: 5 }] }],
    ['a row that is not an object', { processes: [null] }],
  ])('fails on a body with %s', async (_name, body) => {
    answer(json(body));
    expect(await loadProcesses()).toEqual({ status: 'failed' });
  });

  it('passes the signal to the call and fails when it aborts', async () => {
    calls = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            calls.push({ url, init });
            init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
          }),
      ),
    );
    const controller = new AbortController();
    const result = loadProcesses(controller.signal);
    controller.abort();
    expect(await result).toEqual({ status: 'failed' });
    expect(calls[0]?.init?.signal).toBe(controller.signal);
  });
});
