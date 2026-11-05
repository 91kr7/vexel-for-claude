import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerHookEventRoute } from './hook-event-route.js';
import { SessionStateTracker } from './session-state-tracker.js';

let app: FastifyInstance;
let tracker: SessionStateTracker;
let nextId = 0;

beforeAll(async () => {
  tracker = new SessionStateTracker();
  app = Fastify();
  registerHookEventRoute(app, tracker);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

function trackSession(): string {
  nextId += 1;
  const id = `session-${nextId}`;
  tracker.track({ id, cwd: '/projects/demo', onExit: () => () => {} });
  return id;
}

const post = (id: string, payload: string, contentType = 'application/json') =>
  app.inject({ method: 'POST', url: `/api/sessions/${id}/hook-events`, headers: { 'content-type': contentType }, payload });

describe('POST /api/sessions/:id/hook-events', () => {
  // plan-claude_sessions_client/REQ-14: a hook event reaches the tracker of that session
  it('204 and the event updates the session state', async () => {
    const id = trackSession();
    const response = await post(id, JSON.stringify({ session_id: 'x', hook_event_name: 'PermissionRequest', tool_name: 'Bash' }));
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(tracker.get(id)?.state).toBe('needs_input');
  });

  // plan-claude_sessions_client/REQ-14: reads tool_name, notification_type and prompt
  it('passes tool_name, notification_type and prompt to the tracker', async () => {
    const id = trackSession();
    await post(id, JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: 'Rinomina la funzione' }));
    expect(tracker.get(id)).toMatchObject({ state: 'working', label: 'Rinomina la funzione' });
    await post(id, JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion' }));
    expect(tracker.get(id)?.state).toBe('needs_input');
    await post(id, JSON.stringify({ hook_event_name: 'Notification', notification_type: 'idle_prompt' }));
    expect(tracker.get(id)?.state).toBe('idle');
  });

  // plan-claude_sessions_client/REQ-14: an event that changes nothing is still accepted
  it('204 for an event that changes nothing', async () => {
    const id = trackSession();
    const response = await post(id, JSON.stringify({ hook_event_name: 'SessionStart' }));
    expect(response.statusCode).toBe(204);
    expect(tracker.get(id)?.state).toBe('idle');
  });

  // plan-claude_sessions_client/REQ-14: unknown session
  it('404 session_not_found for an unknown id', async () => {
    const response = await post('no-such-session', JSON.stringify({ hook_event_name: 'Stop' }));
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'session_not_found' });
  });

  // plan-claude_sessions_client/REQ-14: body that is not a JSON object, or without a string hook_event_name
  it('400 invalid_event when the body is not a JSON object or hook_event_name is not a string', async () => {
    const id = trackSession();
    const invalid = ['[]', '"Stop"', '42', 'null', '{}', '{"hook_event_name":7}', '{"hook_event_name":null}'];
    for (const payload of invalid) {
      const response = await post(id, payload);
      expect(response.statusCode, payload).toBe(400);
      expect(response.json(), payload).toEqual({ error: 'invalid_event' });
    }
    expect(tracker.get(id)?.state).toBe('idle');
  });

  // plan-claude_sessions_client/REQ-14: malformed JSON is not a JSON object
  it('400 invalid_event for malformed JSON', async () => {
    const id = trackSession();
    const response = await post(id, '{"hook_event_name":');
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_event' });
  });

  // plan-claude_sessions_client/REQ-14: hook inputs can be large (tool output), up to 64 MiB
  it('accepts a body of about 60 MiB', async () => {
    const id = trackSession();
    const payload = JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'Read', tool_response: 'x'.repeat(60 * 1024 * 1024) });
    const response = await post(id, payload);
    expect(response.statusCode).toBe(204);
    expect(tracker.get(id)?.state).toBe('working');
  }, 30_000);
});
