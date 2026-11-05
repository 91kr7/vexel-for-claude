import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerSessionListRoute } from './session-list-route.js';
import { SessionStateTracker } from './session-state-tracker.js';

let app: FastifyInstance;
let tracker: SessionStateTracker;

beforeAll(async () => {
  tracker = new SessionStateTracker({ now: () => new Date('2026-11-05T09:30:00.000Z') });
  app = Fastify();
  registerSessionListRoute(app, tracker);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('GET /api/sessions', () => {
  // plan-claude_sessions_client/REQ-11: empty when no session is hosted
  it('200 and an empty array with no session', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/sessions' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  // plan-claude_sessions_client/REQ-11, REQ-12, REQ-20: every session with its summary, start order, ended ones kept
  it('200 and every session with id, folder, label, state and last activity, in start order, ended ones included', async () => {
    let exitB: () => void = () => {};
    tracker.track({ id: 'a', cwd: '/projects/alpha', onExit: () => {} });
    tracker.track({ id: 'b', cwd: '/projects/beta', onExit: (listener) => (exitB = listener) });
    tracker.track({ id: 'c', cwd: '/projects/gamma', onExit: () => {} });
    tracker.applyHookEvent('c', { hook_event_name: 'UserPromptSubmit', prompt: 'Correggi il bug' });
    exitB();

    const response = await app.inject({ method: 'GET', url: '/api/sessions' });
    expect(response.statusCode).toBe(200);
    const lastActivity = '2026-11-05T09:30:00.000Z';
    expect(response.json()).toEqual([
      { id: 'a', folder: '/projects/alpha', label: 'alpha', state: 'idle', lastActivity },
      { id: 'b', folder: '/projects/beta', label: 'beta', state: 'ended', lastActivity },
      { id: 'c', folder: '/projects/gamma', label: 'Correggi il bug', state: 'working', lastActivity },
    ]);
  });
});
