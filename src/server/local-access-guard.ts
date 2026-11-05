import type { FastifyInstance } from 'fastify';

const LOCAL_HOST = /^(localhost|127\.0\.0\.1)(:\d+)?$/i;
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

export function isLocalRequest(host: string | undefined, origin: string | undefined): boolean {
  return host !== undefined && LOCAL_HOST.test(host) && (origin === undefined || LOCAL_ORIGIN.test(origin));
}

export function registerLocalAccessGuard(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    if (!isLocalRequest(request.headers.host, request.headers.origin)) {
      if (request.headers.upgrade?.toLowerCase() === 'websocket') {
        // The refused upgrade never reaches the websocket plugin, which would otherwise close the socket.
        const socket = request.raw.socket;
        reply.raw.once('finish', () => socket.end(() => socket.destroy()));
      }
      return reply.code(403).send({ error: 'forbidden' });
    }
  });
}
