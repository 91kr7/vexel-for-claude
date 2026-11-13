import { isAbsolute } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { ProjectMarkStore } from './project-mark-store.js';

export function registerProjectRemoveRoute(app: FastifyInstance, marks: Pick<ProjectMarkStore, 'remove'>): void {
  app.post<{ Body: unknown }>('/api/projects/remove', async (request, reply) => {
    const { folder } = (request.body ?? {}) as { folder?: unknown };
    if (typeof folder !== 'string' || !isAbsolute(folder)) {
      return reply.code(400).send({ error: 'invalid_path' });
    }
    await marks.remove(folder);
    return reply.code(204).send();
  });
}
