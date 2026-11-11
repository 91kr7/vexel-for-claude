import { beforeEach, describe, expect, it } from 'vitest';
import { SessionFavoriteStore } from './session-favorite-store.js';
import { type ChangeCause, SessionStateTracker, type SessionSummary } from './session-state-tracker.js';

let favorites: SessionFavoriteStore;
let tracker: SessionStateTracker;
let changes: { id: string; favorite: boolean; state: string; lastActivity: string; cause: ChangeCause['type'] }[];
const exits = new Map<string, () => void>();

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const favoriteChanges = () => changes.filter((c) => c.cause === 'favorite');

function newTracker(initial: string[] = []): void {
  favorites = new SessionFavoriteStore(undefined, initial);
  tracker = new SessionStateTracker({ favorites });
  changes = [];
  tracker.onChange((summary: SessionSummary, cause: ChangeCause) =>
    changes.push({ id: summary.id, favorite: summary.favorite === true, state: summary.state, lastActivity: summary.lastActivity, cause: cause.type }),
  );
}

function track(id: string, resumedFrom?: { sessionId: string; firstUserMessage?: string }): void {
  tracker.track({ id, cwd: `/projects/${id}`, onExit: (listener: () => void) => void exits.set(id, listener), ...(resumedFrom ? { resumedFrom } : {}) } as never);
}

const prompt = (id: string, text: string, sessionId?: string) =>
  tracker.applyHookEvent(id, { hook_event_name: 'UserPromptSubmit', prompt: text, ...(sessionId ? { session_id: sessionId } : {}) });

beforeEach(() => {
  exits.clear();
  newTracker();
});

describe('SessionStateTracker with favorites', () => {
  it('has no favorite field on a session without the mark', () => {
    track('h1');
    expect(tracker.get('h1')).not.toHaveProperty('favorite');
  });

  // plan-favorite_session/REQ-3: with no Claude Code session id, the key is the hosted id
  it('shows favorite: true for the hosted id while no Claude Code session id is known', async () => {
    track('h1');
    prompt('h1', 'Fix the login form');
    await favorites.set('h1', true);
    expect(tracker.get('h1')?.favorite).toBe(true);
    expect(tracker.list().map((s) => s.favorite)).toEqual([true]);
  });

  it('shows favorite: true for the Claude Code session id when it is known', async () => {
    track('h1');
    prompt('h1', 'Fix the login form', 'claude-1');
    await settle();
    await favorites.set('claude-1', true);
    expect(tracker.get('h1')?.favorite).toBe(true);
  });

  it('ignores a mark of a key that is not the key of the session', async () => {
    track('h1');
    prompt('h1', 'Fix the login form', 'claude-1');
    await settle();
    await favorites.set('h1', true);
    await favorites.set('other', true);
    expect(tracker.get('h1')).not.toHaveProperty('favorite');
    expect(favoriteChanges()).toEqual([]);
  });

  it('marks a session tracked after the mark was set', () => {
    newTracker(['h1']);
    track('h1');
    expect(tracker.get('h1')?.favorite).toBe(true);
  });

  // plan-favorite_session/REQ-7: a resumed session starts with the Claude Code session id of the conversation
  it('marks a resumed session at once, by the Claude Code session id it resumes', () => {
    newTracker(['claude-1']);
    track('h2', { sessionId: 'claude-1' });
    expect(tracker.get('h2')?.favorite).toBe(true);
  });

  // plan-favorite_session/REQ-8: a change goes out at once, with the cause "favorite"
  it('notifies the session with the cause "favorite" when the mark is set, and when it is removed', async () => {
    track('h1');
    prompt('h1', 'Fix the login form');
    changes = [];
    await favorites.set('h1', true);
    expect(changes).toEqual([expect.objectContaining({ id: 'h1', favorite: true, cause: 'favorite' })]);
    changes = [];
    await favorites.set('h1', false);
    expect(changes).toEqual([expect.objectContaining({ id: 'h1', favorite: false, cause: 'favorite' })]);
    expect(tracker.get('h1')).not.toHaveProperty('favorite');
  });

  // plan-favorite_session/REQ-8: an ended session is notified too
  it('notifies an ended session', async () => {
    track('h1');
    prompt('h1', 'Fix the login form');
    exits.get('h1')?.();
    changes = [];
    await favorites.set('h1', true);
    expect(changes).toEqual([expect.objectContaining({ id: 'h1', state: 'ended', favorite: true, cause: 'favorite' })]);
  });

  // plan-favorite_session/REQ-9: state and last activity stay as they are
  it('keeps the state and the last activity of the session when the mark changes', async () => {
    track('h1');
    prompt('h1', 'Fix the login form');
    const before = tracker.get('h1');
    await favorites.set('h1', true);
    const after = tracker.get('h1');
    expect(after?.state).toBe(before?.state);
    expect(after?.lastActivity).toBe(before?.lastActivity);
    expect(changes.at(-1)).toMatchObject({ state: before?.state, lastActivity: before?.lastActivity });
  });

  it('notifies every tracked session that has the key', async () => {
    track('h1');
    track('h2', { sessionId: 'claude-1' });
    prompt('h1', 'One', 'claude-1');
    await settle();
    changes = [];
    await favorites.set('claude-1', true);
    expect(favoriteChanges().map((c) => c.id).sort()).toEqual(['h1', 'h2']);
  });

  it('notifies no session for the mark of a key nobody has', async () => {
    track('h1');
    changes = [];
    await favorites.set('other', true);
    expect(changes).toEqual([]);
  });

  // plan-favorite_session/REQ-7: the Claude Code session id appears, the mark moves from the hosted id to it
  it('moves the mark from the hosted id to the Claude Code session id when it becomes known', async () => {
    track('h1');
    await favorites.set('h1', true);
    changes = [];
    prompt('h1', 'Fix the login form', 'claude-1');
    await settle();
    expect(favorites.has('h1')).toBe(false);
    expect(favorites.has('claude-1')).toBe(true);
    expect(tracker.get('h1')?.favorite).toBe(true);
    expect(changes.filter((c) => !c.favorite && c.cause === 'favorite')).toEqual([]);
  });

  it('moves the mark when the Claude Code session id changes', async () => {
    track('h1');
    prompt('h1', 'Fix the login form', 'claude-1');
    await settle();
    await favorites.set('claude-1', true);
    prompt('h1', 'Again', 'claude-2');
    await settle();
    expect(favorites.has('claude-1')).toBe(false);
    expect(favorites.has('claude-2')).toBe(true);
    expect(tracker.get('h1')?.favorite).toBe(true);
  });

  it('does not move the mark when the same Claude Code session id arrives again', async () => {
    track('h1');
    prompt('h1', 'Fix the login form', 'claude-1');
    await settle();
    await favorites.set('claude-1', true);
    changes = [];
    prompt('h1', 'Again', 'claude-1');
    await settle();
    expect(favorites.has('claude-1')).toBe(true);
    expect(favoriteChanges()).toEqual([]);
  });
});
