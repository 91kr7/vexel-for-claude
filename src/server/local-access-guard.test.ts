import fastifyWebsocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import net from 'node:net';
import WebSocket from 'ws';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isLocalRequest, registerLocalAccessGuard } from './local-access-guard.js';

describe('isLocalRequest', () => {
  it.each([
    ['localhost', undefined],
    ['127.0.0.1', undefined],
    ['localhost:3000', undefined],
    ['127.0.0.1:3100', undefined],
    ['LOCALHOST:5173', undefined],
  ])('passes Host %s without Origin, with no allowed port', (host, origin) => {
    expect(isLocalRequest(host, origin)).toBe(true);
  });

  it.each([
    ['localhost:3000', 'http://localhost:3000', [3000]],
    ['127.0.0.1:3000', 'http://127.0.0.1:3000', [3000]],
    ['localhost:3000', 'http://127.0.0.1:3000', [3000]],
    ['localhost:3000', 'http://localhost:5173', [3000, 5173]],
    ['localhost:3000', 'http://127.0.0.1:5173', [3000, 5173]],
    ['localhost:4001', 'HTTP://LOCALHOST:4001', [4001]],
    ['localhost:4001', 'Http://127.0.0.1:4001', [4001]],
    ['localhost', 'http://localhost', [80]],
    ['localhost', 'http://127.0.0.1', [80]],
    ['localhost', 'http://localhost:80', [80]],
  ])('passes Host %s with Origin %s when the allowed ports are %j', (host, origin, ports) => {
    expect(isLocalRequest(host, origin, ports)).toBe(true);
  });

  it.each([
    ['http://localhost:3000'],
    ['http://127.0.0.1:3000'],
    ['http://localhost'],
  ])('rejects Origin %s when no port is allowed', (origin) => {
    expect(isLocalRequest('localhost:3000', origin)).toBe(false);
    expect(isLocalRequest('localhost:3000', origin, [])).toBe(false);
  });

  it.each([
    // plan-claude_sessions_client/REQ-39: loopback on another port
    ['http://localhost:8080'],
    ['http://127.0.0.1:8080'],
    ['http://localhost:3001'],
    ['http://localhost:5173'],
    ['http://localhost'],
    ['http://127.0.0.1'],
    // https is not the client's own origin
    ['https://localhost:3000'],
    ['https://127.0.0.1:3000'],
    ['ws://localhost:3000'],
    // plan-claude_sessions_client/REQ-40: host not loopback, also on the client's port
    ['http://example.com:3000'],
    ['http://evil.com'],
    ['http://localhost.evil.com:3000'],
    ['http://evil-localhost:3000'],
    ['http://192.168.1.10:3000'],
    ['http://127.0.0.2:3000'],
    ['http://[::1]:3000'],
    ['http://0.0.0.0:3000'],
    // plan-claude_sessions_client/REQ-41: null and malformed
    ['null'],
    [''],
    ['not-an-origin'],
    ['localhost:3000'],
    ['http://'],
    ['http://localhost:'],
    ['http://localhost:abc'],
    ['http://localhost:3000/'],
    ['http://localhost:3000/api'],
    ['http://localhost:3000?x=1'],
    ['http://user@localhost:3000'],
    [' http://localhost:3000'],
    ['http://localhost:3000 '],
    ['http://localhost:3000, http://evil.com'],
    ['file://'],
    ['ftp://localhost:3000'],
  ])('rejects Origin %s when only port 3000 is allowed', (origin) => {
    expect(isLocalRequest('localhost:3000', origin, [3000])).toBe(false);
  });

  it.each([
    [undefined, undefined],
    ['', undefined],
    ['192.168.1.10:3000', undefined],
    ['example.com', undefined],
    ['localhost.evil.com', undefined],
    ['evil-localhost', undefined],
    ['127.0.0.2', undefined],
    ['[::1]:3000', undefined],
    ['example.com:3000', 'http://localhost:3000'],
    ['192.168.1.10:3000', 'http://127.0.0.1:3000'],
  ])('rejects Host %s with Origin %s even with port 3000 allowed', (host, origin) => {
    expect(isLocalRequest(host, origin, [3000])).toBe(false);
  });
});

describe('registerLocalAccessGuard', () => {
  let app: FastifyInstance;
  let port: number;

  beforeAll(async () => {
    app = Fastify();
    registerLocalAccessGuard(app);
    await app.register(fastifyWebsocket);
    app.get('/api/ping', async () => ({ ok: true }));
    app.post('/api/ping', async () => ({ ok: true }));
    app.get('/api/socket', { websocket: true }, (socket) => socket.send('opened'));
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (address === null || typeof address === 'string') throw new Error('no port');
    port = address.port;
  });

  afterAll(async () => {
    await app.close();
  });

  it('lets a local request through', async () => {
    const response = await app.inject({ url: '/api/ping', headers: { host: `localhost:${port}` } });
    expect(response.statusCode).toBe(200);
  });

  it.each([
    ['a foreign Host', { host: '192.168.1.67:3000' }],
    ['a foreign Origin', { host: 'localhost', origin: 'http://evil.com' }],
  ])('403 forbidden for %s on a route', async (_label, headers) => {
    const response = await app.inject({ url: '/api/ping', headers });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'forbidden' });
  });

  it.each(['GET', 'POST'] as const)('lets a %s from the own origin of the listening port through, on both loopback names', async (method) => {
    for (const origin of [`http://localhost:${port}`, `http://127.0.0.1:${port}`]) {
      const response = await app.inject({ method, url: '/api/ping', headers: { host: `127.0.0.1:${port}`, origin } });
      expect(response.statusCode, origin).toBe(200);
    }
  });

  it.each(['GET', 'POST'] as const)('403 forbidden for a %s from a loopback origin on another port, Vite included', async (method) => {
    for (const origin of [`http://localhost:${port + 1}`, 'http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:5173', 'http://localhost']) {
      const response = await app.inject({ method, url: '/api/ping', headers: { host: `127.0.0.1:${port}`, origin } });
      expect(response.statusCode, origin).toBe(403);
      expect(response.json(), origin).toEqual({ error: 'forbidden' });
    }
  });

  it('403 forbidden runs before the not-found handler', async () => {
    const response = await app.inject({ url: '/no-such-page', headers: { host: 'evil.com' } });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'forbidden' });
  });

  function upgrade(headers: Record<string, string>): Promise<{ opened: boolean; status?: number }> {
    return new Promise((resolve) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/api/socket`, { headers });
      socket.on('open', () => {
        socket.close();
        resolve({ opened: true });
      });
      socket.on('unexpected-response', (request, response) => {
        resolve({ opened: false, status: response.statusCode });
        response.destroy();
        request.destroy();
      });
      socket.on('error', () => {});
    });
  }

  it.each([['localhost'], ['127.0.0.1']])('a WebSocket upgrade from the own origin on %s opens', async (name) => {
    expect(await upgrade({ Origin: `http://${name}:${port}` })).toEqual({ opened: true });
  });

  it('a WebSocket upgrade without Origin opens', async () => {
    expect(await upgrade({})).toEqual({ opened: true });
  });

  it.each([
    ['a foreign Origin', { Origin: 'http://evil.com' }],
    ['a loopback Origin on another port', { Origin: 'http://localhost:8080' }],
    ['the Vite Origin without a Vite port', { Origin: 'http://localhost:5173' }],
    ['an https Origin on the own port', { Origin: 'https://localhost:PORT' }],
    ['the Origin null', { Origin: 'null' }],
    ['a foreign Host', { Host: 'attacker.example:80' }],
  ])('refuses a WebSocket upgrade with %s with 403 before it opens', async (_label, headers) => {
    const withPort = Object.fromEntries(Object.entries(headers).map(([name, value]) => [name, value.replace('PORT', String(port))]));
    expect(await upgrade(withPort)).toEqual({ opened: false, status: 403 });
  });

  it('closes the connection after the 403 to a refused WebSocket upgrade', async () => {
    const result = await new Promise<{ status: string; closedByServer: boolean }>((resolve) => {
      const socket = net.connect(port, '127.0.0.1', () => {
        socket.write(
          'GET /api/socket HTTP/1.1\r\nHost: localhost\r\nOrigin: http://evil.com\r\n' +
            'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
            'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n',
        );
      });
      let raw = '';
      const timer = setTimeout(() => {
        socket.destroy();
        resolve({ status: raw.split('\r\n')[0] ?? '', closedByServer: false });
      }, 3000);
      socket.on('data', (chunk) => (raw += chunk.toString()));
      socket.on('end', () => {
        clearTimeout(timer);
        socket.destroy();
        resolve({ status: raw.split('\r\n')[0] ?? '', closedByServer: true });
      });
      socket.on('error', () => {});
    });
    expect(result.status).toMatch(/^HTTP\/1\.1 403/);
    expect(result.closedByServer).toBe(true);
  });
});

describe('registerLocalAccessGuard with a Vite dev port', () => {
  const vitePort = 5173;
  let app: FastifyInstance;
  let port: number;

  beforeAll(async () => {
    app = Fastify();
    registerLocalAccessGuard(app, { viteDevPort: vitePort });
    await app.register(fastifyWebsocket);
    app.post('/api/ping', async () => ({ ok: true }));
    app.get('/api/socket', { websocket: true }, (socket) => socket.send('opened'));
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (address === null || typeof address === 'string') throw new Error('no port');
    port = address.port;
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (origin: string) => app.inject({ method: 'POST', url: '/api/ping', headers: { host: `localhost:${port}`, origin } });

  it('allows the Vite origins and still the own origins', async () => {
    for (const origin of [`http://localhost:${vitePort}`, `http://127.0.0.1:${vitePort}`, `http://localhost:${port}`, `http://127.0.0.1:${port}`]) {
      expect((await post(origin)).statusCode, origin).toBe(200);
    }
  });

  it('still rejects the other origins', async () => {
    for (const origin of ['http://localhost:8080', `https://localhost:${vitePort}`, `http://example.com:${vitePort}`, 'null']) {
      const response = await post(origin);
      expect(response.statusCode, origin).toBe(403);
      expect(response.json(), origin).toEqual({ error: 'forbidden' });
    }
  });

  it('opens a WebSocket from the Vite origin', async () => {
    const opened = await new Promise<boolean>((resolve) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/api/socket`, { headers: { Origin: `http://localhost:${vitePort}` } });
      socket.on('open', () => {
        socket.close();
        resolve(true);
      });
      socket.on('unexpected-response', (request, response) => {
        resolve(false);
        response.destroy();
        request.destroy();
      });
      socket.on('error', () => resolve(false));
    });
    expect(opened).toBe(true);
  });
});

describe('registerLocalAccessGuard before the app listens', () => {
  async function readyApp(viteDevPort?: number): Promise<FastifyInstance> {
    const app = Fastify();
    registerLocalAccessGuard(app, viteDevPort === undefined ? {} : { viteDevPort });
    app.get('/api/ping', async () => ({ ok: true }));
    await app.ready();
    return app;
  }

  const get = (app: FastifyInstance, origin?: string) =>
    app.inject({ url: '/api/ping', headers: origin === undefined ? { host: 'localhost:3000' } : { host: 'localhost:3000', origin } });

  it('allows only the Vite origin when a Vite port is given', async () => {
    const app = await readyApp(5173);
    expect((await get(app, 'http://localhost:5173')).statusCode).toBe(200);
    expect((await get(app, 'http://localhost:3000')).statusCode).toBe(403);
    expect((await get(app)).statusCode).toBe(200);
    await app.close();
  });

  it('allows no origin without a Vite port', async () => {
    const app = await readyApp();
    expect((await get(app, 'http://localhost:3000')).statusCode).toBe(403);
    expect((await get(app, 'http://localhost')).statusCode).toBe(403);
    expect((await get(app)).statusCode).toBe(200);
    await app.close();
  });
});
