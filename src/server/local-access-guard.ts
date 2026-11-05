import type { FastifyInstance } from 'fastify';

const LOCAL_HOST = /^(localhost|127\.0\.0\.1)(:\d+)?$/i;
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

export function isLocalRequest(host: string | undefined, origin: string | undefined): boolean {
  return host !== undefined && LOCAL_HOST.test(host) && (origin === undefined || LOCAL_ORIGIN.test(origin));
}

export function registerLocalAccessGuard(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    if (!isLocalRequest(request.headers.host, request.headers.origin)) {
      return reply.code(403).send({ error: 'forbidden' });
    }
  });
}
