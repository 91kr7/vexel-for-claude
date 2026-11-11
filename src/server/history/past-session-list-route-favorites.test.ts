import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { SessionFavoriteStore } from '../sessions/session-favorite-store.js';
import { registerPastSessionListRoute } from './past-session-list-route.js';
import type { PastSession } from './session-history.js';

const past = (id: string): PastSession => ({
  id,
  folder: '/work/app',
  firstUserMessage: `First message of ${id}`,
  lastModified: new Date(id === 'marked' ? '2026-11-04T12:00:00.000Z' : '2026-11-03T12:00:00.000Z'),
});

async function pastSessions(favorites: SessionFavoriteStore, liveIds: string[] = []) {
  const app = Fastify();
  registerPastSessionListRoute(app, {
    history: { list: async () => [past('marked'), past('plain')] },
    externalCheck: { runningSessionIds: async () => new Set() },
    registry: { list: () => [] },
    tracker: { liveClaudeSessionIds: () => new Set(liveIds) },
    favorites,
  });
  const response = await app.inject({ method: 'GET', url: '/api/past-sessions' });
  await app.close();
  expect(response.statusCode).toBe(200);
  const [group] = response.json() as { sessions: { id: string; favorite?: true }[] }[];
  return group?.sessions ?? [];
}

describe('GET /api/past-sessions with favorites', () => {
  // plan-favorite_session/REQ-4: a marked past session has favorite: true, the others have no field
  it('gives favorite: true to the marked session and nothing to the others', async () => {
    const sessions = await pastSessions(new SessionFavoriteStore(undefined, ['marked']));
    expect(sessions.map((s) => [s.id, s.favorite])).toEqual([
      ['marked', true],
      ['plain', undefined],
    ]);
    expect(sessions[1]).not.toHaveProperty('favorite');
  });

  // plan-favorite_session/REQ-5: with the mark removed, no row is marked
  it('gives no favorite field once the mark is removed', async () => {
    const favorites = new SessionFavoriteStore(undefined, ['marked']);
    await favorites.set('marked', false);
    const sessions = await pastSessions(favorites);
    expect(sessions.some((s) => 'favorite' in s)).toBe(false);
  });

  // plan-favorite_session/REQ-10: the key stays after Dismiss, so the history still marks the session
  it('still marks a session whose list entry was dismissed (no live session holds its id)', async () => {
    const sessions = await pastSessions(new SessionFavoriteStore(undefined, ['marked']), []);
    expect(sessions.find((s) => s.id === 'marked')?.favorite).toBe(true);
  });
});
