import { isAbsolute } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { ProjectMarkStore } from './project-mark-store.js';

export function registerProjectFavoriteRoute(app: FastifyInstance, marks: Pick<ProjectMarkStore, 'setFavorite'>): void {
  app.put<{ Body: unknown }>('/api/projects/favorite', async (request, reply) => {
    const { folder, favorite } = (request.body ?? {}) as { folder?: unknown; favorite?: unknown };
    if (typeof folder !== 'string' || !isAbsolute(folder)) {
      return reply.code(400).send({ error: 'invalid_path' });
    }
    if (typeof favorite !== 'boolean') {
      return reply.code(400).send({ error: 'invalid_favorite' });
    }
    await marks.setFavorite(folder, favorite);
    return reply.code(204).send();
  });
}
