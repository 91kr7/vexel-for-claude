import type { FastifyInstance } from 'fastify';
import type { ExternalSessionScanner } from '../external/external-session-scanner.js';
import type { SessionFavoriteStore } from './session-favorite-store.js';
import type { SessionStateTracker } from './session-state-tracker.js';

export interface FavoriteSessionDependencies {
  tracker: Pick<SessionStateTracker, 'get' | 'claudeSessionId'>;
  scanner: Pick<ExternalSessionScanner, 'get'>;
  favorites: Pick<SessionFavoriteStore, 'set'>;
}

export function registerFavoriteSessionRoute(app: FastifyInstance, deps: FavoriteSessionDependencies): void {
  app.put<{ Params: { id: string }; Body: unknown }>('/api/sessions/:id/favorite', async (request, reply) => {
    const { id } = request.params;
    const key = deps.tracker.get(id) ? (deps.tracker.claudeSessionId(id) ?? id) : deps.scanner.get(id) ? id : undefined;
    if (key === undefined) {
      return reply.code(404).send({ error: 'session_not_found' });
    }
    const favorite = (request.body as { favorite?: unknown } | null | undefined)?.favorite;
    if (typeof favorite !== 'boolean') {
      return reply.code(400).send({ error: 'invalid_favorite' });
    }
    await deps.favorites.set(key, favorite);
    return reply.code(204).send();
  });
}
