import type { FastifyInstance } from 'fastify';
import type { ExternalSessionCheck } from '../history/external-session-check.js';
import { type ResumeSessionDependencies, resumePastSession } from '../history/resume-session-route.js';
import type { SessionRegistry } from './session-registry.js';
import type { SessionStateTracker } from './session-state-tracker.js';

export interface ResumeEndedSessionDependencies {
  tracker: Pick<SessionStateTracker, 'get' | 'claudeSessionId' | 'dismiss'>;
  history: ResumeSessionDependencies['history'];
  registry: Pick<SessionRegistry, 'start' | 'list'>;
  externalCheck: Pick<ExternalSessionCheck, 'runningSessionIds'>;
}

export function registerResumeEndedSessionRoute(app: FastifyInstance, deps: ResumeEndedSessionDependencies): void {
  app.post<{ Params: { id: string }; Body: { force?: unknown } | undefined }>('/api/sessions/:id/resume', async (request, reply) => {
    const session = deps.tracker.get(request.params.id);
    if (!session) {
      return reply.code(404).send({ error: 'session_not_found' });
    }
    if (session.state !== 'ended') {
      return reply.code(409).send({ error: 'not_ended' });
    }
    const claudeSessionId = deps.tracker.claudeSessionId(session.id);
    if (claudeSessionId === undefined) {
      return reply.code(404).send({ error: 'session_not_found' });
    }
    if (request.body?.force !== true) {
      const hostedPids = deps.registry
        .list()
        .filter((hosted) => !hosted.exited)
        .map((hosted) => hosted.pid);
      if ((await deps.externalCheck.runningSessionIds(hostedPids)).has(claudeSessionId)) {
        return reply.code(409).send({ error: 'running_elsewhere' });
      }
    }
    const result = await resumePastSession(deps, claudeSessionId);
    if ('error' in result) {
      return reply.code(404).send(result);
    }
    deps.tracker.dismiss(session.id);
    return reply.code(201).send(result);
  });
}
