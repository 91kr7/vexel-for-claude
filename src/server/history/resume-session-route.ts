import { stat } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import type { SessionRegistry } from '../sessions/session-registry.js';
import type { SessionHistory } from './session-history.js';

export interface ResumeSessionDependencies {
  history: Pick<SessionHistory, 'get'>;
  registry: Pick<SessionRegistry, 'start'>;
}

export type ResumeResult = { id: string } | { error: 'session_not_found' | 'folder_not_found' };

export async function resumePastSession(deps: ResumeSessionDependencies, pastSessionId: string): Promise<ResumeResult> {
  const past = await deps.history.get(pastSessionId);
  if (!past || past.folder === null) return { error: 'session_not_found' };
  const isFolder = await stat(past.folder).then((stats) => stats.isDirectory(), () => false);
  if (!isFolder) return { error: 'folder_not_found' };
  const session = deps.registry.start(past.folder, { sessionId: past.id, firstUserMessage: past.firstUserMessage });
  return { id: session.id };
}

export function registerResumeSessionRoute(app: FastifyInstance, deps: ResumeSessionDependencies): void {
  app.post<{ Params: { id: string } }>('/api/past-sessions/:id/resume', async (request, reply) => {
    const result = await resumePastSession(deps, request.params.id);
    return 'error' in result ? reply.code(404).send(result) : reply.code(201).send(result);
  });
}
