import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ExternalSessionSummary } from '../external/external-session-scanner.js';
import { registerFavoriteSessionRoute } from './favorite-session-route.js';
import { registerSessionListRoute } from './session-list-route.js';
import { SessionFavoriteStore } from './session-favorite-store.js';
import { type ChangeCause, SessionStateTracker } from './session-state-tracker.js';

let app: FastifyInstance;
let tracker: SessionStateTracker;
let favorites: SessionFavoriteStore;
let externals: Map<string, ExternalSessionSummary>;
let favoriteChanges: string[];
const exits = new Map<string, () => void>();

function trackNew(id: string, claudeSessionId?: string): void {
  tracker.track({ id, cwd: `/projects/${id}`, onExit: (listener) => void exits.set(id, listener) });
  tracker.applyHookEvent(id, { hook_event_name: 'UserPromptSubmit', prompt: `Fix the ${id} page`, ...(claudeSessionId ? { session_id: claudeSessionId } : {}) });
}

const external = (id: string): ExternalSessionSummary => ({
  id,
  folder: `/work/${id}`,
  label: `Label of ${id}`,
  state: 'idle',
  lastActivity: '2026-11-11T10:00:00.000Z',
  external: true,
});

const put = (id: string, body: unknown) =>
  app.inject({ method: 'PUT', url: `/api/sessions/${encodeURIComponent(id)}/favorite`, payload: body as object, headers: { 'content-type': 'application/json' } });
const listed = async () => (await app.inject({ method: 'GET', url: '/api/sessions' })).json() as { id: string; favorite?: true }[];

beforeEach(async () => {
  favorites = new SessionFavoriteStore();
  tracker = new SessionStateTracker({ favorites });
  externals = new Map();
  favoriteChanges = [];
  tracker.onChange((summary, cause: ChangeCause) => {
    if (cause.type === 'favorite') favoriteChanges.push(summary.id);
  });
  exits.clear();
  app = Fastify();
  const scanner = { get: (id: string) => externals.get(id), list: () => [...externals.values()], onChange: () => () => {} };
  registerSessionListRoute(app, tracker, scanner as never);
  registerFavoriteSessionRoute(app, { tracker, scanner, favorites });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('PUT /api/sessions/:id/favorite', () => {
  // plan-favorite_session/REQ-1: 204 with an empty body, and the session is listed as favorite
  it('204 with an empty body; the hosted session is listed with favorite: true', async () => {
    trackNew('h1');
    const response = await put('h1', { favorite: true });
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect((await listed()).find((s) => s.id === 'h1')?.favorite).toBe(true);
  });

  // plan-favorite_session/REQ-5: favorite false removes the mark
  it('removes the mark with { favorite: false }', async () => {
    trackNew('h1');
    await put('h1', { favorite: true });
    expect((await put('h1', { favorite: false })).statusCode).toBe(204);
    expect((await listed()).find((s) => s.id === 'h1')?.favorite).toBeUndefined();
  });

  // FavoriteSessionRoute rule: 204 comes after the new mark went out
  it('notifies the change before it answers', async () => {
    trackNew('h1');
    await put('h1', { favorite: true });
    expect(favoriteChanges).toEqual(['h1']);
  });

  // FavoriteSessionRoute "Key of the mark"
  it('stores the mark under the Claude Code session id when known, else under the hosted id', async () => {
    trackNew('known', 'claude-1');
    trackNew('unknown');
    expect((await put('known', { favorite: true })).statusCode).toBe(204);
    expect((await put('unknown', { favorite: true })).statusCode).toBe(204);
    expect(favorites.has('claude-1')).toBe(true);
    expect(favorites.has('known')).toBe(false);
    expect(favorites.has('unknown')).toBe(true);
  });

  // plan-favorite_session/REQ-2: any state, ended included
  it.each([
    ['idle', (): unknown => tracker.applyHookEvent('s', { hook_event_name: 'Stop' })],
    ['working', (): unknown => undefined],
    ['needs_input', (): unknown => tracker.applyHookEvent('s', { hook_event_name: 'PermissionRequest', tool_name: 'Bash' })],
    ['ended', (): unknown => exits.get('s')?.()],
  ] as const)('marks a %s hosted session', async (state, toState) => {
    trackNew('s', 'claude-s');
    toState();
    expect(tracker.get('s')?.state).toBe(state);
    expect((await put('s', { favorite: true })).statusCode).toBe(204);
    expect(favorites.has('claude-s')).toBe(true);
  });

  // plan-favorite_session/REQ-2: an external session
  it('marks an external session under its id', async () => {
    externals.set('ext-1', external('ext-1'));
    expect((await put('ext-1', { favorite: true })).statusCode).toBe(204);
    expect(favorites.has('ext-1')).toBe(true);
  });

  // plan-favorite_session/REQ-9: marking does not change the place of the entry
  it('keeps the order of the list', async () => {
    trackNew('a');
    trackNew('b');
    trackNew('c');
    const before = (await listed()).map((s) => s.id);
    await put('b', { favorite: true });
    expect((await listed()).map((s) => s.id)).toEqual(before);
  });

  it('answers 204 again, and changes nothing, for the same request twice', async () => {
    trackNew('h1');
    await put('h1', { favorite: true });
    favoriteChanges.length = 0;
    expect((await put('h1', { favorite: true })).statusCode).toBe(204);
    expect(favoriteChanges).toEqual([]);
  });

  it('404 session_not_found for an unknown id, and changes nothing', async () => {
    const response = await put('nope', { favorite: true });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'session_not_found' });
    expect(favorites.has('nope')).toBe(false);
  });

  it.each([
    ['missing', {}],
    ['a string', { favorite: 'true' }],
    ['a number', { favorite: 1 }],
    ['null', { favorite: null }],
  ])('400 invalid_favorite when favorite is %s, and changes nothing', async (_, body) => {
    trackNew('h1');
    const response = await put('h1', body);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_favorite' });
    expect(favorites.has('h1')).toBe(false);
  });

  it('400 invalid_favorite when there is no body', async () => {
    trackNew('h1');
    const response = await app.inject({ method: 'PUT', url: '/api/sessions/h1/favorite' });
    expect(response.statusCode).toBe(400);
    expect(favorites.has('h1')).toBe(false);
  });
});
