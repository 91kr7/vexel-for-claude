import type { FastifyInstance } from 'fastify';
import type { SessionFavoriteStore } from '../sessions/session-favorite-store.js';
import type { SessionHistory } from './session-history.js';

export interface PastSessionFavoriteDependencies {
  history: Pick<SessionHistory, 'get'>;
  favorites: Pick<SessionFavoriteStore, 'set'>;
}

export function registerPastSessionFavoriteRoute(app: FastifyInstance, deps: PastSessionFavoriteDependencies): void {
  app.put<{ Params: { id: string }; Body: unknown }>('/api/past-sessions/:id/favorite', async (request, reply) => {
    const { id } = request.params;
    if (!(await deps.history.get(id))) {
      return reply.code(404).send({ error: 'session_not_found' });
    }
    const favorite = (request.body as { favorite?: unknown } | null | undefined)?.favorite;
    if (typeof favorite !== 'boolean') {
      return reply.code(400).send({ error: 'invalid_favorite' });
    }
    await deps.favorites.set(id, favorite);
    return reply.code(204).send();
  });
}
