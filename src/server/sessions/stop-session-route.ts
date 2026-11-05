import type { FastifyInstance } from 'fastify';
import type { SessionRegistry } from './session-registry.js';

export function registerStopSessionRoute(app: FastifyInstance, registry: SessionRegistry): void {
  app.post<{ Params: { id: string } }>('/api/sessions/:id/stop', async (request, reply) => {
    const session = registry.get(request.params.id);
    if (!session) {
      return reply.code(404).send({ error: 'session_not_found' });
    }
    session.stop();
    return reply.code(202).send();
  });
}
