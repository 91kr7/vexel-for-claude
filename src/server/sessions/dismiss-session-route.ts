import type { FastifyInstance } from 'fastify';
import type { ExternalSessionScanner } from '../external/external-session-scanner.js';
import type { SessionStateTracker } from './session-state-tracker.js';

export function registerDismissSessionRoute(
  app: FastifyInstance,
  tracker: Pick<SessionStateTracker, 'get' | 'dismiss'>,
  scanner?: Pick<ExternalSessionScanner, 'get' | 'dismiss'>,
): void {
  app.post<{ Params: { id: string } }>('/api/sessions/:id/dismiss', async (request, reply) => {
    const session = tracker.get(request.params.id);
    if (!session) {
      // An external session whose terminal closed.
      const external = scanner?.get(request.params.id);
      if (!external) return reply.code(404).send({ error: 'session_not_found' });
      if (!scanner?.dismiss(external.id)) return reply.code(409).send({ error: 'not_ended' });
      return reply.code(204).send();
    }
    if (!tracker.dismiss(session.id)) {
      return reply.code(409).send({ error: 'not_ended' });
    }
    return reply.code(204).send();
  });
}
