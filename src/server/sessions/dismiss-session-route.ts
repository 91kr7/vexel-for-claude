import type { FastifyInstance } from 'fastify';
import type { SessionStateTracker } from './session-state-tracker.js';

export function registerDismissSessionRoute(app: FastifyInstance, tracker: Pick<SessionStateTracker, 'get' | 'dismiss'>): void {
  app.post<{ Params: { id: string } }>('/api/sessions/:id/dismiss', async (request, reply) => {
    const session = tracker.get(request.params.id);
    if (!session) {
      return reply.code(404).send({ error: 'session_not_found' });
    }
    if (!tracker.dismiss(session.id)) {
      return reply.code(409).send({ error: 'not_ended' });
    }
    return reply.code(204).send();
  });
}
