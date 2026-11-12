import { stat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { NAME_MAX_LENGTH, nameLength, type SessionNameStore } from './session-name-store.js';
import type { SessionRegistry } from './session-registry.js';
import type { SessionStateTracker } from './session-state-tracker.js';

interface StartSessionBody {
  path?: unknown;
  name?: unknown;
}

export interface StartSessionDependencies {
  registry: Pick<SessionRegistry, 'start'>;
  tracker: Pick<SessionStateTracker, 'claudeSessionId'>;
  names: Pick<SessionNameStore, 'set'>;
}

export function registerStartSessionRoute(app: FastifyInstance, deps: StartSessionDependencies): void {
  app.post<{ Body: StartSessionBody | null }>('/api/sessions', async (request, reply) => {
    const path = request.body?.path;
    if (typeof path !== 'string' || !isAbsolute(path)) {
      return reply.code(400).send({ error: 'invalid_path' });
    }
    const name = request.body?.name;
    if (name !== undefined && typeof name !== 'string') {
      return reply.code(400).send({ error: 'invalid_name' });
    }
    const trimmedName = name?.trim() ?? '';
    if (nameLength(trimmedName) > NAME_MAX_LENGTH) {
      return reply.code(400).send({ error: 'name_too_long' });
    }
    const folder = resolve(path);
    const isFolder = await stat(folder).then((stats) => stats.isDirectory(), () => false);
    if (!isFolder) {
      return reply.code(404).send({ error: 'folder_not_found' });
    }
    const session = deps.registry.start(folder);
    if (trimmedName !== '') {
      await deps.names.set(deps.tracker.claudeSessionId(session.id) ?? session.id, trimmedName);
    }
    return reply.code(201).send({ id: session.id });
  });
}
