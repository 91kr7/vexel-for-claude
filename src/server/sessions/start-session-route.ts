import { stat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { SessionRegistry } from './session-registry.js';

interface StartSessionBody {
  path?: unknown;
}

export function registerStartSessionRoute(app: FastifyInstance, registry: SessionRegistry): void {
  app.post<{ Body: StartSessionBody | null }>('/api/sessions', async (request, reply) => {
    const path = request.body?.path;
    if (typeof path !== 'string' || !isAbsolute(path)) {
      return reply.code(400).send({ error: 'invalid_path' });
    }
    const folder = resolve(path);
    const isFolder = await stat(folder).then((stats) => stats.isDirectory(), () => false);
    if (!isFolder) {
      return reply.code(404).send({ error: 'folder_not_found' });
    }
    const session = registry.start(folder);
    return reply.code(201).send({ id: session.id });
  });
}
