import type { FastifyInstance } from 'fastify';
import type { ExternalSessionScanner } from '../external/external-session-scanner.js';
import type { ExternalSessionCheck } from '../history/external-session-check.js';
import { type ResumeSessionDependencies, resumePastSession } from '../history/resume-session-route.js';
import type { SessionRegistry } from './session-registry.js';
import type { SessionStateTracker } from './session-state-tracker.js';

export interface ResumeEndedSessionDependencies {
  tracker: Pick<SessionStateTracker, 'get' | 'claudeSessionId' | 'dismiss'>;
  history: ResumeSessionDependencies['history'];
  registry: Pick<SessionRegistry, 'start' | 'list'>;
  externalCheck: Pick<ExternalSessionCheck, 'runningSessionIds'>;
  scanner?: Pick<ExternalSessionScanner, 'get' | 'dismiss'>;
}

async function runningElsewhere(deps: ResumeEndedSessionDependencies, claudeSessionId: string): Promise<boolean> {
  const hostedPids = deps.registry
    .list()
    .filter((hosted) => !hosted.exited)
    .map((hosted) => hosted.pid);
  return (await deps.externalCheck.runningSessionIds(hostedPids)).has(claudeSessionId);
}

export function registerResumeEndedSessionRoute(app: FastifyInstance, deps: ResumeEndedSessionDependencies): void {
  app.post<{ Params: { id: string }; Body: { force?: unknown } | undefined }>('/api/sessions/:id/resume', async (request, reply) => {
    const session = deps.tracker.get(request.params.id);
    if (!session) {
      // An external session whose terminal closed: its id is the Claude session id.
      const external = deps.scanner?.get(request.params.id);
      if (!external) return reply.code(404).send({ error: 'session_not_found' });
      if (external.state !== 'ended') return reply.code(409).send({ error: 'not_ended' });
      if (request.body?.force !== true && (await runningElsewhere(deps, external.id))) {
        return reply.code(409).send({ error: 'running_elsewhere' });
      }
      const result = await resumePastSession(deps, external.id);
      if ('error' in result) return reply.code(404).send(result);
      deps.scanner?.dismiss(external.id);
      return reply.code(201).send(result);
    }
    if (session.state !== 'ended') {
      return reply.code(409).send({ error: 'not_ended' });
    }
    const claudeSessionId = deps.tracker.claudeSessionId(session.id);
    if (claudeSessionId === undefined) {
      return reply.code(404).send({ error: 'session_not_found' });
    }
    if (request.body?.force !== true && (await runningElsewhere(deps, claudeSessionId))) {
      return reply.code(409).send({ error: 'running_elsewhere' });
    }
    const result = await resumePastSession(deps, claudeSessionId);
    if ('error' in result) {
      return reply.code(404).send(result);
    }
    deps.tracker.dismiss(session.id);
    return reply.code(201).send(result);
  });
}
