// Tests of plan-desktop_app, batch window-tray: QuitCheck spec (REQ-17).
import http from 'node:http';
import net from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmQuit, countBusySessions, quitConfirmation } from './quit-check.js';

const servers: http.Server[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

/** A fake backend; `requests` records the path of every request it receives. */
async function serve(handler: http.RequestListener): Promise<{ origin: string; requests: string[] }> {
  const requests: string[] = [];
  const server = http.createServer((request, response) => {
    requests.push(request.url ?? '');
    handler(request, response);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { origin: `http://127.0.0.1:${(server.address() as net.AddressInfo).port}`, requests };
}

const sessions = (body: unknown, status = 200): http.RequestListener => (request, response) => {
  if (request.url !== '/api/sessions') return void response.writeHead(404).end();
  response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
};

async function freeOrigin(): Promise<string> {
  const probe = net.createServer();
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const { port } = probe.address() as net.AddressInfo;
  await new Promise((resolve) => probe.close(resolve));
  return `http://127.0.0.1:${port}`;
}

const mixed = [
  { id: 'a', state: 'working' },
  { id: 'b', state: 'needs_input' },
  { id: 'c', state: 'idle' },
  { id: 'd', state: 'ended' },
  { id: 'e', state: 'working', external: true },
  { id: 'f', state: 'needs_input', external: true },
  { id: 'g', state: 'working', external: false },
];

describe('countBusySessions', () => {
  it('counts the hosted sessions that are working or need input, never the external ones', async () => {
    const { origin } = await serve(sessions(mixed));
    expect(await countBusySessions(origin)).toBe(3);
  });

  it('is 0 when no session is busy', async () => {
    const { origin } = await serve(sessions([{ id: 'c', state: 'idle' }, { id: 'e', state: 'working', external: true }]));
    expect(await countBusySessions(origin)).toBe(0);
  });

  it.each([
    ['a status other than 200', sessions(mixed, 500)],
    ['a body that is not an array', sessions({ sessions: mixed })],
    ['a body that is not JSON', ((_request, response) => response.writeHead(200).end('nope')) as http.RequestListener],
  ])('is 0 on %s', async (_label, handler) => {
    const { origin } = await serve(handler);
    expect(await countBusySessions(origin)).toBe(0);
  });

  it('is 0 on a network error', async () => {
    expect(await countBusySessions(await freeOrigin())).toBe(0);
  });

  it('is 0 when the backend does not answer within 2 seconds', async () => {
    const { origin } = await serve(() => undefined);
    const start = Date.now();
    expect(await countBusySessions(origin)).toBe(0);
    expect(Date.now() - start).toBeLessThan(2800);
  });
});

describe('quitConfirmation', () => {
  it('is a warning titled "Quit Vexel for Claude?" with "Cancel" as default and cancel button, then "Quit"', () => {
    expect(quitConfirmation(3)).toMatchObject({
      type: 'warning',
      title: 'Quit Vexel for Claude?',
      message: 'Quit Vexel for Claude?',
      detail: '3 sessions are working or need input. Quitting ends them.',
      buttons: ['Cancel', 'Quit'],
      defaultId: 0,
      cancelId: 0,
    });
  });

  it('uses the singular for one session', () => {
    expect(quitConfirmation(1).detail).toBe('1 session is working or needs input. Quitting ends it.');
  });
});

describe('confirmQuit', () => {
  const answer = (response: number) => vi.fn(async () => ({ response }));

  it('quits without request or dialog when no backend is ready', async () => {
    const ask = answer(0);
    expect(await confirmQuit(undefined, ask)).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });

  it('quits without request or dialog when the app did not start the backend', async () => {
    const { origin, requests } = await serve(sessions(mixed));
    const ask = answer(0);
    expect(await confirmQuit({ origin, startedByApp: false }, ask)).toBe(true);
    expect(ask).not.toHaveBeenCalled();
    expect(requests).toEqual([]);
  });

  it('quits without dialog when no session is busy', async () => {
    const { origin } = await serve(sessions([{ id: 'c', state: 'idle' }]));
    const ask = answer(0);
    expect(await confirmQuit({ origin, startedByApp: true }, ask)).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });

  it('quits without dialog when the sessions do not answer', async () => {
    const ask = answer(0);
    expect(await confirmQuit({ origin: await freeOrigin(), startedByApp: true }, ask)).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });

  it('asks with the busy count and quits when the user chooses "Quit"', async () => {
    const { origin } = await serve(sessions(mixed));
    const ask = answer(1);
    expect(await confirmQuit({ origin, startedByApp: true }, ask)).toBe(true);
    expect(ask).toHaveBeenCalledTimes(1);
    expect(ask).toHaveBeenCalledWith(quitConfirmation(3));
  });

  it('keeps the app running when the user chooses "Cancel"', async () => {
    const { origin } = await serve(sessions(mixed));
    const ask = answer(0);
    expect(await confirmQuit({ origin, startedByApp: true }, ask)).toBe(false);
    expect(ask).toHaveBeenCalledTimes(1);
  });
});
