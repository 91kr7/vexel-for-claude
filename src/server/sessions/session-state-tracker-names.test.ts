import { beforeEach, describe, expect, it } from 'vitest';
import { SessionNameStore } from './session-name-store.js';
import { type ChangeCause, SessionStateTracker, type SessionSummary } from './session-state-tracker.js';

let names: SessionNameStore;
let tracker: SessionStateTracker;
let changes: { id: string; label: string; cause: ChangeCause['type'] }[];
const exits = new Map<string, () => void>();

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const nameChanges = () => changes.filter((c) => c.cause === 'name');

function newTracker(initial: [string, string][] = []): void {
  names = new SessionNameStore(undefined, initial);
  tracker = new SessionStateTracker({ names });
  changes = [];
  tracker.onChange((summary: SessionSummary, cause: ChangeCause) => changes.push({ id: summary.id, label: summary.label, cause: cause.type }));
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

describe('SessionStateTracker with names', () => {
  // plan-session_list_improvements/REQ-26: with no Claude Code session id, the name key is the hosted id
  it('labels a session with the name of its hosted id while no Claude Code session id is known', async () => {
    track('h1');
    prompt('h1', 'Fix the login form');
    await names.set('h1', 'Release fix');
    expect(tracker.get('h1')?.label).toBe('Release fix');
    expect(tracker.list().map((s) => s.label)).toEqual(['Release fix']);
  });

  // plan-session_list_improvements/REQ-26: with a known Claude Code session id, the name key is that id
  it('labels a session with the name of its Claude Code session id', async () => {
    track('h1');
    prompt('h1', 'Fix the login form', 'claude-1');
    await settle();
    await names.set('claude-1', 'Release fix');
    expect(tracker.get('h1')?.label).toBe('Release fix');
  });

  it('labels a session tracked after the name was set', () => {
    newTracker([['h1', 'Release fix']]);
    track('h1');
    expect(tracker.get('h1')?.label).toBe('Release fix');
    expect(changes).toEqual([{ id: 'h1', label: 'Release fix', cause: 'track' }]);
  });

  // plan-session_list_improvements/REQ-37: a name change goes out at once, with the cause "name"
  it('notifies the new label with the cause "name" when the name changes', async () => {
    track('h1');
    prompt('h1', 'Fix the login form');
    changes = [];
    await names.set('h1', 'Release fix');
    expect(changes).toEqual([{ id: 'h1', label: 'Release fix', cause: 'name' }]);
  });

  // plan-session_list_improvements/REQ-31: removing the name brings back the default label
  it('brings back the default label, notified with the cause "name", when the name is removed', async () => {
    track('h1');
    prompt('h1', '  Fix   the login form ');
    await names.set('h1', 'Release fix');
    changes = [];
    await names.set('h1', '   ');
    expect(tracker.get('h1')?.label).toBe('Fix the login form');
    expect(changes).toEqual([{ id: 'h1', label: 'Fix the login form', cause: 'name' }]);
  });

  // plan-session_list_improvements/REQ-25, REQ-37: an ended session still changes its label
  it('renames an ended session and notifies it', async () => {
    track('h1');
    prompt('h1', 'Fix the login form');
    exits.get('h1')?.();
    expect(tracker.get('h1')?.state).toBe('ended');
    changes = [];
    await names.set('h1', 'Release fix');
    expect(tracker.get('h1')).toMatchObject({ label: 'Release fix', state: 'ended' });
    expect(changes).toEqual([{ id: 'h1', label: 'Release fix', cause: 'name' }]);
  });

  it('notifies nothing when the label does not change, or the key belongs to no session', async () => {
    track('h1');
    prompt('h1', 'Fix the login form');
    changes = [];
    await names.set('h1', 'Fix the login form');
    await names.set('someone-else', 'Other');
    expect(changes).toEqual([]);
    expect(tracker.get('h1')?.label).toBe('Fix the login form');
  });

  it('notifies every tracked session that shares the name key', async () => {
    track('h1');
    track('h2');
    prompt('h1', 'One', 'claude-1');
    prompt('h2', 'Two', 'claude-1');
    await settle();
    changes = [];
    await names.set('claude-1', 'Shared');
    expect(nameChanges().map((c) => [c.id, c.label]).sort()).toEqual([
      ['h1', 'Shared'],
      ['h2', 'Shared'],
    ]);
  });

  // plan-session_list_improvements/REQ-36: the name follows the session when its Claude Code session id becomes known
  it('moves the name from the hosted id to the Claude Code session id when that id is set, keeping the label', async () => {
    track('h1');
    await names.set('h1', 'Release fix');
    changes = [];
    prompt('h1', 'Fix the login form', 'claude-1');
    await settle();
    expect(names.get('h1')).toBeUndefined();
    expect(names.get('claude-1')).toBe('Release fix');
    expect(tracker.get('h1')?.label).toBe('Release fix');
    expect(nameChanges()).toEqual([]);
  });

  // plan-session_list_improvements/REQ-36: Claude Code may give a resumed session a new id
  it('moves the name to the new Claude Code session id when the id changes', async () => {
    track('h1');
    prompt('h1', 'Fix the login form', 'claude-1');
    await settle();
    await names.set('claude-1', 'Release fix');
    tracker.applyHookEvent('h1', { hook_event_name: 'SessionStart', session_id: 'claude-2' });
    await settle();
    expect(names.get('claude-1')).toBeUndefined();
    expect(names.get('claude-2')).toBe('Release fix');
    expect(tracker.get('h1')?.label).toBe('Release fix');
  });

  it('takes the name the new key already had, notified with the cause "name"', async () => {
    newTracker([['claude-1', 'Saved name']]);
    track('h1');
    prompt('h1', 'Fix the login form');
    changes = [];
    tracker.applyHookEvent('h1', { hook_event_name: 'SessionStart', session_id: 'claude-1' });
    await settle();
    expect(tracker.get('h1')?.label).toBe('Saved name');
    expect(nameChanges()).toEqual([{ id: 'h1', label: 'Saved name', cause: 'name' }]);
  });

  // plan-session_list_improvements/REQ-36: a resumed session starts with the name of its conversation
  it('labels a session resumed from a named conversation with that name, over the first user message', () => {
    newTracker([['claude-1', 'Release fix']]);
    track('h2', { sessionId: 'claude-1', firstUserMessage: 'Fix the login form' });
    expect(tracker.get('h2')?.label).toBe('Release fix');
    expect(changes).toEqual([{ id: 'h2', label: 'Release fix', cause: 'track' }]);
  });

  it('has the default label with no name store', () => {
    tracker = new SessionStateTracker();
    track('h1');
    prompt('h1', 'Fix the login form');
    expect(tracker.get('h1')?.label).toBe('Fix the login form');
  });
});
