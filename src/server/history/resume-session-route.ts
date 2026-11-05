import { stat } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import type { SessionRegistry } from '../sessions/session-registry.js';
import type { SessionHistory } from './session-history.js';

export interface ResumeSessionDependencies {
  history: Pick<SessionHistory, 'get'>;
  registry: Pick<SessionRegistry, 'start'>;
}

export function registerResumeSessionRoute(app: FastifyInstance, deps: ResumeSessionDependencies): void {
  app.post<{ Params: { id: string } }>('/api/past-sessions/:id/resume', async (request, reply) => {
    const past = await deps.history.get(request.params.id);
    if (!past || past.folder === null) {
      return reply.code(404).send({ error: 'session_not_found' });
    }
    const isFolder = await stat(past.folder).then((stats) => stats.isDirectory(), () => false);
    if (!isFolder) {
      return reply.code(404).send({ error: 'folder_not_found' });
    }
    const session = deps.registry.start(past.folder, { sessionId: past.id, firstUserMessage: past.firstUserMessage });
    return reply.code(201).send({ id: session.id });
  });
}
