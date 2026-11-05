import fastifyWebsocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Socket } from 'node:net';
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
    ['localhost:3000', 'http://localhost:5173'],
    ['127.0.0.1:3000', 'http://127.0.0.1:3000'],
    ['localhost', 'https://localhost'],
    ['localhost', 'http://127.0.0.1'],
    ['localhost', 'HTTP://LOCALHOST:8080'],
  ])('passes Host %s with Origin %s', (host, origin) => {
    expect(isLocalRequest(host, origin)).toBe(true);
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
    ['localhost:3000', 'http://evil.com'],
    ['localhost:3000', 'http://localhost.evil.com'],
    ['localhost:3000', 'http://192.168.1.10:3000'],
    ['localhost:3000', 'null'],
    ['localhost:3000', 'file://'],
    ['localhost:3000', 'ftp://localhost'],
    ['localhost:3000', ''],
  ])('rejects Host %s with Origin %s', (host, origin) => {
    expect(isLocalRequest(host, origin)).toBe(false);
  });
});

describe('registerLocalAccessGuard', () => {
  let app: FastifyInstance;
  let port: number;
  const connections = new Set<Socket>();

  beforeAll(async () => {
    app = Fastify();
    app.server.on('connection', (socket: Socket) => connections.add(socket));
    registerLocalAccessGuard(app);
    await app.register(fastifyWebsocket);
    app.get('/api/ping', async () => ({ ok: true }));
    app.get('/api/socket', { websocket: true }, (socket) => socket.send('opened'));
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (address === null || typeof address === 'string') throw new Error('no port');
    port = address.port;
  });

  afterAll(async () => {
    // The server keeps refused upgrade connections open, so close them here or close() never resolves.
    for (const socket of connections) socket.destroy();
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

  it('a local WebSocket upgrade opens', async () => {
    expect(await upgrade({ Origin: `http://localhost:${port}` })).toEqual({ opened: true });
  });

  it.each([
    ['a foreign Origin', { Origin: 'http://evil.com' }],
    ['a foreign Host', { Host: 'attacker.example:80' }],
  ])('refuses a WebSocket upgrade with %s with 403 before it opens', async (_label, headers) => {
    expect(await upgrade(headers)).toEqual({ opened: false, status: 403 });
  });
});
