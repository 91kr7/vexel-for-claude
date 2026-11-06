import type { FastifyInstance } from 'fastify';

const LOCAL_HOST = /^(localhost|127\.0\.0\.1)(:\d+)?$/i;
const LOCAL_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::([1-9]\d{0,4}))?$/i;
const DEFAULT_HTTP_PORT = 80;

export interface LocalAccessGuardOptions {
  viteDevPort?: number;
}

export function isLocalRequest(host: string | undefined, origin: string | undefined, allowedPorts: readonly number[] = []): boolean {
  return host !== undefined && LOCAL_HOST.test(host) && (origin === undefined || isAllowedOrigin(origin, allowedPorts));
}

function isAllowedOrigin(origin: string, allowedPorts: readonly number[]): boolean {
  const match = LOCAL_ORIGIN.exec(origin);
  if (match === null) return false;
  const port = match[1] === undefined ? DEFAULT_HTTP_PORT : Number(match[1]);
  return allowedPorts.includes(port);
}

function listeningPort(app: FastifyInstance): number | undefined {
  const address = app.server.address();
  return address !== null && typeof address === 'object' ? address.port : undefined;
}

export function registerLocalAccessGuard(app: FastifyInstance, options: LocalAccessGuardOptions = {}): void {
  app.addHook('onRequest', async (request, reply) => {
    const allowedPorts = [listeningPort(app), options.viteDevPort].filter((port) => port !== undefined);
    if (!isLocalRequest(request.headers.host, request.headers.origin, allowedPorts)) {
      if (request.headers.upgrade?.toLowerCase() === 'websocket') {
        // The refused upgrade never reaches the websocket plugin, which would otherwise close the socket.
        const socket = request.raw.socket;
        reply.raw.once('finish', () => socket.end(() => socket.destroy()));
      }
      return reply.code(403).send({ error: 'forbidden' });
    }
  });
}
