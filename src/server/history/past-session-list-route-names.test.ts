import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { SessionNameStore } from '../sessions/session-name-store.js';
import { registerPastSessionListRoute } from './past-session-list-route.js';
import type { PastSession } from './session-history.js';

const past = (id: string, firstUserMessage: string): PastSession => ({
  id,
  folder: '/work/app',
  firstUserMessage,
  lastModified: new Date(id === 'named' ? '2026-11-04T12:00:00.000Z' : '2026-11-03T12:00:00.000Z'),
});

describe('GET /api/past-sessions with names', () => {
  // plan-session_list_improvements/REQ-29, REQ-30: the name is the label the history shows and searches
  it('gives the name as the label of a named session, and the first user message for the others', async () => {
    const app = Fastify();
    registerPastSessionListRoute(app, {
      history: { list: async () => [past('named', 'Fix the login form'), past('plain', '  Update   the README ')] },
      externalCheck: { runningSessionIds: async () => new Set() },
      registry: { list: () => [] },
      tracker: { liveClaudeSessionIds: () => new Set() },
      names: new SessionNameStore(undefined, [['named', 'Release fix']]),
    });
    const response = await app.inject({ method: 'GET', url: '/api/past-sessions' });
    await app.close();

    expect(response.statusCode).toBe(200);
    const [group] = response.json() as { sessions: { id: string; label: string }[] }[];
    expect(group?.sessions.map((s) => [s.id, s.label])).toEqual([
      ['named', 'Release fix'],
      ['plain', 'Update the README'],
    ]);
  });
});
