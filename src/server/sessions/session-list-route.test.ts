import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ExternalSessionScanner } from '../external/external-session-scanner.js';
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
      { id: 'c', folder: '/projects/gamma', label: 'Correggi il bug', state: 'working', lastActivity, resumable: true },
    ]);
  });
});

describe('GET /api/sessions, needs input', () => {
  const now = new Date('2026-11-05T10:00:00.000Z');
  let needsApp: FastifyInstance;
  let needsTracker: SessionStateTracker;

  beforeAll(async () => {
    needsTracker = new SessionStateTracker({ now: () => now });
    const scanner = new ExternalSessionScanner({
      check: {
        runningSessions: async () => [
          { pid: 7001, sessionId: 'ext-waiting', cwd: '/projects/mobile-app', kind: 'interactive', status: 'waiting', updatedAt: now.getTime() },
          { pid: 7002, sessionId: 'ext-busy', cwd: '/projects/docs-site', kind: 'interactive', status: 'busy', updatedAt: now.getTime() },
        ],
      } as never,
      history: { get: async () => undefined } as never,
      hostedPids: () => [],
      now: () => now,
    });
    await scanner.scan();
    needsApp = Fastify();
    registerSessionListRoute(needsApp, needsTracker, scanner);
    await needsApp.ready();
  });

  afterAll(async () => {
    await needsApp.close();
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-22: a hosted session waiting for a permission carries its tool, the others carry none
  it('gives the waiting tool of a hosted session in needs input, and no waiting tool to the others', async () => {
    needsTracker.track({ id: 'asks', cwd: '/projects/web-dashboard', onExit: () => {} });
    needsTracker.applyHookEvent('asks', { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
    needsTracker.track({ id: 'works', cwd: '/projects/billing-api', onExit: () => {} });
    needsTracker.applyHookEvent('works', { hook_event_name: 'PreToolUse', tool_name: 'Edit' });

    const response = await needsApp.inject({ method: 'GET', url: '/api/sessions' });
    expect(response.statusCode).toBe(200);
    const byId = new Map((response.json() as { id: string }[]).map((s) => [s.id, s]));
    expect(byId.get('asks')).toEqual({
      id: 'asks',
      folder: '/projects/web-dashboard',
      label: 'web-dashboard',
      state: 'needs_input',
      lastActivity: now.toISOString(),
      waitingTool: 'Bash',
    });
    expect(byId.get('works')).toMatchObject({ state: 'working' });
    expect(byId.get('works')).not.toHaveProperty('waitingTool');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-17, REQ-25: an external session that waits for the user is in needs input
  it('gives needs_input to an external session that waits for the user, after the hosted ones', async () => {
    const response = await needsApp.inject({ method: 'GET', url: '/api/sessions' });
    const sessions = response.json() as { id: string; state: string; external?: boolean }[];
    expect(sessions.slice(-2)).toEqual([
      expect.objectContaining({ id: 'ext-waiting', folder: '/projects/mobile-app', state: 'needs_input', external: true }),
      expect.objectContaining({ id: 'ext-busy', state: 'working', external: true }),
    ]);
  });
});
