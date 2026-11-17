import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerFavoriteSessionRoute } from '../sessions/favorite-session-route.js';
import { SessionFavoriteStore } from '../sessions/session-favorite-store.js';
import { registerSessionListRoute } from '../sessions/session-list-route.js';
import { type ChangeCause, SessionStateTracker } from '../sessions/session-state-tracker.js';
import { registerPastSessionFavoriteRoute } from './past-session-favorite-route.js';
import type { PastSession } from './session-history.js';

let app: FastifyInstance;
let favorites: SessionFavoriteStore;
let tracker: SessionStateTracker;
let pastSessions: Map<string, PastSession>;
let storeChanges: [string, boolean][];
let listChanges: string[];
const exits = new Map<string, () => void>();

const past = (id: string): PastSession => ({ id, folder: `/projects/${id}`, firstUserMessage: `Fix ${id}`, lastModified: new Date('2026-11-10T10:00:00Z') });

const put = (id: string, body?: unknown) =>
  app.inject({
    method: 'PUT',
    url: `/api/past-sessions/${encodeURIComponent(id)}/favorite`,
    ...(body === undefined ? {} : { payload: body as object, headers: { 'content-type': 'application/json' } }),
  });
const listed = async () => (await app.inject({ method: 'GET', url: '/api/sessions' })).json() as { id: string; favorite?: true }[];

function endedHostedSession(id: string, claudeSessionId: string): void {
  tracker.track({ id, cwd: `/projects/${id}`, onExit: (listener) => void exits.set(id, listener) });
  tracker.applyHookEvent(id, { hook_event_name: 'UserPromptSubmit', prompt: `Fix ${id}`, session_id: claudeSessionId });
  exits.get(id)?.();
}

beforeEach(async () => {
  favorites = new SessionFavoriteStore();
  tracker = new SessionStateTracker({ favorites });
  pastSessions = new Map();
  storeChanges = [];
  listChanges = [];
  exits.clear();
  favorites.onChange((key, favorite) => storeChanges.push([key, favorite]));
  tracker.onChange((summary, cause: ChangeCause) => {
    if (cause.type === 'favorite') listChanges.push(summary.id);
  });
  app = Fastify();
  const history = { get: async (id: string) => pastSessions.get(id) };
  const scanner = { get: () => undefined, list: () => [], onChange: () => () => {} };
  registerSessionListRoute(app, tracker, scanner as never);
  registerFavoriteSessionRoute(app, { tracker, scanner, favorites });
  registerPastSessionFavoriteRoute(app, { history, favorites });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('PUT /api/past-sessions/:id/favorite', () => {
  // plan-resume_favorites/REQ-5: marking a past session
  it('204 with an empty body; the mark of the Claude Code session id is set', async () => {
    pastSessions.set('claude-1', past('claude-1'));
    const response = await put('claude-1', { favorite: true });
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(favorites.has('claude-1')).toBe(true);
  });

  // plan-resume_favorites/REQ-5: removing the mark
  it('removes the mark with { favorite: false }', async () => {
    pastSessions.set('claude-1', past('claude-1'));
    await put('claude-1', { favorite: true });
    expect((await put('claude-1', { favorite: false })).statusCode).toBe(204);
    expect(favorites.has('claude-1')).toBe(false);
  });

  // PastSessionFavoriteRoute rule: an id with characters that need encoding is the same key
  it('uses the decoded id as the key', async () => {
    pastSessions.set('id/with space', past('id/with space'));
    expect((await put('id/with space', { favorite: true })).statusCode).toBe(204);
    expect(favorites.has('id/with space')).toBe(true);
  });

  // PastSessionFavoriteRoute rule: the same request twice changes nothing the second time
  it('answers 204 again, and changes nothing, for the same request twice', async () => {
    pastSessions.set('claude-1', past('claude-1'));
    await put('claude-1', { favorite: true });
    storeChanges.length = 0;
    expect((await put('claude-1', { favorite: true })).statusCode).toBe(204);
    expect(storeChanges).toEqual([]);
    expect(favorites.has('claude-1')).toBe(true);
  });

  // PastSessionFavoriteRoute 404
  it('404 session_not_found for an id that is not a past session, and changes nothing', async () => {
    const response = await put('nope', { favorite: true });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'session_not_found' });
    expect(favorites.has('nope')).toBe(false);
    expect(storeChanges).toEqual([]);
  });

  // PastSessionFavoriteRoute 400
  it.each([
    ['missing', {}],
    ['a string', { favorite: 'true' }],
    ['a number', { favorite: 1 }],
    ['null', { favorite: null }],
  ])('400 invalid_favorite when favorite is %s, and changes nothing', async (_, body) => {
    pastSessions.set('claude-1', past('claude-1'));
    const response = await put('claude-1', body);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_favorite' });
    expect(favorites.has('claude-1')).toBe(false);
    expect(storeChanges).toEqual([]);
  });

  // PastSessionFavoriteRoute 400: no body at all
  it('400 invalid_favorite when there is no body, and keeps an existing mark', async () => {
    pastSessions.set('claude-1', past('claude-1'));
    await put('claude-1', { favorite: true });
    storeChanges.length = 0;
    const response = await put('claude-1');
    expect(response.statusCode).toBe(400);
    expect(favorites.has('claude-1')).toBe(true);
    expect(storeChanges).toEqual([]);
  });

  // plan-resume_favorites/REQ-8: the session list shows the mark set from the popup, pushed before the answer
  it('an ended list entry with the same Claude Code session id is listed as favorite and notified before 204', async () => {
    endedHostedSession('h1', 'claude-1');
    pastSessions.set('claude-1', past('claude-1'));
    expect((await listed()).find((s) => s.id === 'h1')?.favorite).toBeUndefined();

    expect((await put('claude-1', { favorite: true })).statusCode).toBe(204);
    expect(listChanges).toEqual(['h1']);
    expect((await listed()).find((s) => s.id === 'h1')?.favorite).toBe(true);

    expect((await put('claude-1', { favorite: false })).statusCode).toBe(204);
    expect(listChanges).toEqual(['h1', 'h1']);
    expect((await listed()).find((s) => s.id === 'h1')?.favorite).toBeUndefined();
  });

  // plan-resume_favorites/REQ-8: both routes change the same mark
  it('a mark set from the popup is removed by the session route, and the reverse', async () => {
    endedHostedSession('h1', 'claude-1');
    pastSessions.set('claude-1', past('claude-1'));
    await put('claude-1', { favorite: true });
    await app.inject({ method: 'PUT', url: '/api/sessions/h1/favorite', payload: { favorite: false } });
    expect(favorites.has('claude-1')).toBe(false);

    await app.inject({ method: 'PUT', url: '/api/sessions/h1/favorite', payload: { favorite: true } });
    expect(favorites.has('claude-1')).toBe(true);
    await put('claude-1', { favorite: false });
    expect(favorites.has('claude-1')).toBe(false);
    expect((await listed()).find((s) => s.id === 'h1')?.favorite).toBeUndefined();
  });
});
