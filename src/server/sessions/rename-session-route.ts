import type { FastifyInstance } from 'fastify';
import type { ExternalSessionScanner } from '../external/external-session-scanner.js';
import { NAME_MAX_LENGTH, nameLength, type SessionNameStore } from './session-name-store.js';
import type { SessionStateTracker } from './session-state-tracker.js';

export interface RenameSessionDependencies {
  tracker: Pick<SessionStateTracker, 'get' | 'claudeSessionId'>;
  scanner: Pick<ExternalSessionScanner, 'get'>;
  names: Pick<SessionNameStore, 'set'>;
}

export function registerRenameSessionRoute(app: FastifyInstance, deps: RenameSessionDependencies): void {
  app.put<{ Params: { id: string }; Body: unknown }>('/api/sessions/:id/name', async (request, reply) => {
    const { id } = request.params;
    const key = deps.tracker.get(id) ? (deps.tracker.claudeSessionId(id) ?? id) : deps.scanner.get(id) ? id : undefined;
    if (key === undefined) {
      return reply.code(404).send({ error: 'session_not_found' });
    }
    const name = (request.body as { name?: unknown } | null | undefined)?.name;
    if (typeof name !== 'string') {
      return reply.code(400).send({ error: 'invalid_name' });
    }
    if (nameLength(name.trim()) > NAME_MAX_LENGTH) {
      return reply.code(400).send({ error: 'name_too_long' });
    }
    await deps.names.set(key, name);
    return reply.code(204).send();
  });
}
