import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerDismissSessionRoute } from './dismiss-session-route.js';
import { registerSessionListRoute } from './session-list-route.js';
import { SessionStateTracker } from './session-state-tracker.js';

let app: FastifyInstance;
let tracker: SessionStateTracker;
let removals: string[];
const exits = new Map<string, () => void>();

function trackNew(id: string): void {
  tracker.track({ id, cwd: `/projects/${id}`, onExit: (listener) => void exits.set(id, listener) });
}

const dismiss = (id: string) => app.inject({ method: 'POST', url: `/api/sessions/${encodeURIComponent(id)}/dismiss` });
const listedIds = async () => ((await app.inject({ method: 'GET', url: '/api/sessions' })).json() as { id: string }[]).map((s) => s.id);

beforeEach(async () => {
  tracker = new SessionStateTracker();
  removals = [];
  tracker.onRemove((id) => removals.push(id));
  exits.clear();
  app = Fastify();
  registerSessionListRoute(app, tracker);
  registerDismissSessionRoute(app, tracker);
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('POST /api/sessions/:id/dismiss', () => {
  // plan-session_list_improvements/REQ-4, REQ-5: 204 and the session leaves the list kept by the server
  it('204 with an empty body for an ended session, which then leaves GET /api/sessions', async () => {
    trackNew('ended');
    trackNew('other');
    exits.get('ended')?.();

    const response = await dismiss('ended');

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(await listedIds()).toEqual(['other']);
    expect(removals).toEqual(['ended']);
  });

  // DismissSessionRoute contract: 404 for an unknown id, nothing changes
  it('404 session_not_found for an unknown id', async () => {
    trackNew('other');
    const response = await dismiss('missing');
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'session_not_found' });
    expect(await listedIds()).toEqual(['other']);
    expect(removals).toEqual([]);
  });

  // plan-session_list_improvements/REQ-3: a session that has not ended cannot be dismissed
  it.each([
    ['idle', undefined],
    ['working', 'UserPromptSubmit'],
    ['needs_input', 'PermissionRequest'],
  ] as const)('409 not_ended for a %s session, which stays listed', async (state, hookEventName) => {
    trackNew('live');
    if (hookEventName) tracker.applyHookEvent('live', { hook_event_name: hookEventName, prompt: 'Go' });
    expect(tracker.get('live')?.state).toBe(state);

    const response = await dismiss('live');

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'not_ended' });
    expect(tracker.get('live')?.state).toBe(state);
    expect(await listedIds()).toEqual(['live']);
    expect(removals).toEqual([]);
  });

  // plan-session_list_improvements/REQ-5: a dismissed session stays gone; a second dismiss finds nothing
  it('404 session_not_found when the same session is dismissed a second time', async () => {
    trackNew('ended');
    exits.get('ended')?.();
    expect((await dismiss('ended')).statusCode).toBe(204);

    const again = await dismiss('ended');

    expect(again.statusCode).toBe(404);
    expect(again.json()).toEqual({ error: 'session_not_found' });
    expect(await listedIds()).toEqual([]);
  });
});
