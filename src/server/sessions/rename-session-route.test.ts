import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ExternalSessionSummary } from '../external/external-session-scanner.js';
import { registerRenameSessionRoute } from './rename-session-route.js';
import { registerSessionListRoute } from './session-list-route.js';
import { SessionNameStore } from './session-name-store.js';
import { type ChangeCause, SessionStateTracker } from './session-state-tracker.js';

let app: FastifyInstance;
let tracker: SessionStateTracker;
let names: SessionNameStore;
let externals: Map<string, ExternalSessionSummary>;
let nameChanges: string[];
const exits = new Map<string, () => void>();

function trackNew(id: string, prompt = `Fix the ${id} page`, claudeSessionId?: string): void {
  tracker.track({ id, cwd: `/projects/${id}`, onExit: (listener) => void exits.set(id, listener) });
  tracker.applyHookEvent(id, { hook_event_name: 'UserPromptSubmit', prompt, ...(claudeSessionId ? { session_id: claudeSessionId } : {}) });
}

const rename = (id: string, body: unknown) =>
  app.inject({ method: 'PUT', url: `/api/sessions/${encodeURIComponent(id)}/name`, payload: body as object, headers: { 'content-type': 'application/json' } });
const labelOf = async (id: string) =>
  ((await app.inject({ method: 'GET', url: '/api/sessions' })).json() as { id: string; label: string }[]).find((s) => s.id === id)?.label;

beforeEach(async () => {
  names = new SessionNameStore();
  tracker = new SessionStateTracker({ names });
  externals = new Map();
  nameChanges = [];
  tracker.onChange((summary, cause: ChangeCause) => {
    if (cause.type === 'name') nameChanges.push(`${summary.id}:${summary.label}`);
  });
  exits.clear();
  app = Fastify();
  const scanner = { get: (id: string) => externals.get(id), list: () => [...externals.values()], onChange: () => () => {} };
  registerSessionListRoute(app, tracker, scanner as never);
  registerRenameSessionRoute(app, { tracker, scanner, names });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('PUT /api/sessions/:id/name', () => {
  // plan-session_list_improvements/REQ-25, REQ-26: 204, and the name is the label the list gives
  it('204 with an empty body; the hosted session is listed with its name', async () => {
    trackNew('h1');
    const response = await rename('h1', { name: 'Release fix' });
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(await labelOf('h1')).toBe('Release fix');
  });

  // RenameSessionRoute rule: 204 comes after the new label went out
  it('notifies the new label before it answers', async () => {
    trackNew('h1');
    await rename('h1', { name: 'Release fix' });
    expect(nameChanges).toEqual(['h1:Release fix']);
  });

  // RenameSessionRoute "Key of the name"
  it('stores the name under the Claude Code session id when known, else under the hosted id', async () => {
    trackNew('known', 'One', 'claude-1');
    trackNew('unknown', 'Two');
    expect((await rename('known', { name: 'Named A' })).statusCode).toBe(204);
    expect((await rename('unknown', { name: 'Named B' })).statusCode).toBe(204);
    expect(names.get('claude-1')).toBe('Named A');
    expect(names.get('known')).toBeUndefined();
    expect(names.get('unknown')).toBe('Named B');
  });

  // plan-session_list_improvements/REQ-25: any state, ended included
  it.each([
    ['idle', (): unknown => tracker.applyHookEvent('s', { hook_event_name: 'Stop' })],
    ['working', (): unknown => undefined],
    ['needs_input', (): unknown => tracker.applyHookEvent('s', { hook_event_name: 'PermissionRequest', tool_name: 'Bash' })],
    ['ended', (): unknown => exits.get('s')?.()],
  ] as const)('renames a %s hosted session', async (state, toState) => {
    trackNew('s');
    toState();
    expect(tracker.get('s')?.state).toBe(state);
    expect((await rename('s', { name: 'Release fix' })).statusCode).toBe(204);
    expect(await labelOf('s')).toBe('Release fix');
  });

  // plan-session_list_improvements/REQ-25: an external session, keyed by its own id
  it('renames an external session under its id', async () => {
    externals.set('ext-1', { id: 'ext-1', folder: '/home/dev/job', label: 'Run the job', state: 'idle', lastActivity: '2026-11-06T10:00:00.000Z', external: true });
    const response = await rename('ext-1', { name: 'Terminal job' });
    expect(response.statusCode).toBe(204);
    expect(names.get('ext-1')).toBe('Terminal job');
  });

  // plan-session_list_improvements/REQ-32
  it('stores the name without the spaces at the start and end', async () => {
    trackNew('h1');
    await rename('h1', { name: '  Nightly build \t ' });
    expect(await labelOf('h1')).toBe('Nightly build');
  });

  // plan-session_list_improvements/REQ-31
  it.each([[''], ['    ']])('204 for %j: the default label comes back', async (empty) => {
    trackNew('h1', 'Fix the login form');
    await rename('h1', { name: 'Release fix' });
    const response = await rename('h1', { name: empty });
    expect(response.statusCode).toBe(204);
    expect(await labelOf('h1')).toBe('Fix the login form');
    expect(names.get('h1')).toBeUndefined();
  });

  // plan-session_list_improvements/REQ-33
  it('400 name_too_long over 200 characters after the trim, and nothing changes', async () => {
    trackNew('h1', 'Fix the login form');
    await rename('h1', { name: 'Release fix' });
    nameChanges = [];
    const response = await rename('h1', { name: 'x'.repeat(201) });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'name_too_long' });
    expect(await labelOf('h1')).toBe('Release fix');
    expect(nameChanges).toEqual([]);
  });

  // plan-session_list_improvements/REQ-32, REQ-33: the limit counts after the trim
  it('204 for 200 characters surrounded by spaces', async () => {
    trackNew('h1');
    const response = await rename('h1', { name: `  ${'y'.repeat(200)}  ` });
    expect(response.statusCode).toBe(204);
    expect(await labelOf('h1')).toBe('y'.repeat(200));
  });

  it.each([
    ['a missing name', {}],
    ['a number', { name: 42 }],
    ['null', { name: null }],
  ])('400 invalid_name for %s, and nothing changes', async (_, body) => {
    trackNew('h1', 'Fix the login form');
    const response = await rename('h1', body);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_name' });
    expect(await labelOf('h1')).toBe('Fix the login form');
  });

  it('404 session_not_found for an id that is neither hosted nor external, and nothing is stored', async () => {
    trackNew('h1');
    const response = await rename('missing', { name: 'Release fix' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'session_not_found' });
    expect(names.get('missing')).toBeUndefined();
    expect(nameChanges).toEqual([]);
  });
});
