import { beforeEach, describe, expect, it } from 'vitest';
import { type SessionSummary, SessionStateTracker } from './session-state-tracker.js';

let tracker: SessionStateTracker;
let changes: SessionSummary[];
let removals: string[];
const exits = new Map<string, () => void>();

function trackNew(id: string, resumedFrom?: { sessionId: string; firstUserMessage?: string | null }): void {
  tracker.track({ id, cwd: `/projects/${id}`, onExit: (listener) => void exits.set(id, listener), resumedFrom });
}

const exit = (id: string) => exits.get(id)?.();

beforeEach(() => {
  tracker = new SessionStateTracker({ now: () => new Date('2026-11-06T10:00:00.000Z') });
  exits.clear();
  changes = [];
  removals = [];
  tracker.onChange((summary) => changes.push(summary));
  tracker.onRemove((id) => removals.push(id));
});

describe('SessionStateTracker.dismiss', () => {
  // SessionStateTracker rule: an ended session leaves get, list and claudeSessionId, and removal listeners get its id
  it('removes an ended session from get, list and claudeSessionId and tells the removal listeners', () => {
    trackNew('a');
    trackNew('b');
    tracker.applyHookEvent('b', { hook_event_name: 'SessionStart', session_id: 'claude-b' });
    exit('b');
    changes = [];

    expect(tracker.dismiss('b')).toBe(true);

    expect(tracker.get('b')).toBeUndefined();
    expect(tracker.list().map((s) => s.id)).toEqual(['a']);
    expect(tracker.claudeSessionId('b')).toBeUndefined();
    expect(removals).toEqual(['b']);
    expect(changes, 'dismiss notifies no change listener').toEqual([]);
  });

  // SessionStateTracker rule: an unknown id changes nothing
  it('returns false for an unknown id and calls no listener', () => {
    trackNew('a');
    changes = [];
    expect(tracker.dismiss('missing')).toBe(false);
    expect(tracker.list().map((s) => s.id)).toEqual(['a']);
    expect(removals).toEqual([]);
    expect(changes).toEqual([]);
  });

  // SessionStateTracker rule: only ended sessions can be removed
  it.each([
    ['idle', []],
    ['working', [{ hook_event_name: 'UserPromptSubmit', prompt: 'Fix the bug' }]],
    ['needs_input', [{ hook_event_name: 'PermissionRequest', tool_name: 'Bash' }]],
  ] as const)('returns false for a %s session and leaves it unchanged', (state, events) => {
    trackNew('a');
    for (const event of events) tracker.applyHookEvent('a', event);
    const before = tracker.get('a');
    expect(before?.state).toBe(state);
    changes = [];

    expect(tracker.dismiss('a')).toBe(false);

    expect(tracker.get('a')).toEqual(before);
    expect(removals).toEqual([]);
    expect(changes).toEqual([]);
  });

  // SessionStateTracker rule: a removed session is unknown from then on
  it('ignores hook events and input of a removed session, and a second dismiss returns false', () => {
    trackNew('a');
    exit('a');
    tracker.dismiss('a');
    changes = [];

    expect(tracker.applyHookEvent('a', { hook_event_name: 'UserPromptSubmit', prompt: 'Again' })).toBe(false);
    tracker.applyUserInput('a', 'x');
    expect(tracker.dismiss('a')).toBe(false);

    expect(tracker.get('a')).toBeUndefined();
    expect(changes).toEqual([]);
    expect(removals).toEqual(['a']);
  });

  // SessionStateTracker contract: onRemove returns an unsubscribe
  it('stops calling a removal listener after it unsubscribes', () => {
    const late: string[] = [];
    const unsubscribe = tracker.onRemove((id) => late.push(id));
    trackNew('a');
    trackNew('b');
    exit('a');
    exit('b');

    tracker.dismiss('a');
    unsubscribe();
    tracker.dismiss('b');

    expect(late).toEqual(['a']);
    expect(removals).toEqual(['a', 'b']);
  });
});

describe('SessionSummary.resumable', () => {
  // plan-session_list_improvements/REQ-2: no saved conversation, no resumable mark
  it('is absent for a new session and for one that ended before any prompt', () => {
    trackNew('a');
    expect(tracker.get('a')).not.toHaveProperty('resumable');
    tracker.applyHookEvent('a', { hook_event_name: 'SessionStart', session_id: 'claude-a' });
    exit('a');
    expect(tracker.get('a')?.state).toBe('ended');
    expect(tracker.get('a')).not.toHaveProperty('resumable');
  });

  // plan-session_list_improvements/REQ-2: a UserPromptSubmit saves the conversation; the mark stays after the end
  it('is true after a UserPromptSubmit and stays true when the session ends', () => {
    trackNew('a');
    tracker.applyHookEvent('a', { hook_event_name: 'UserPromptSubmit', prompt: 'Fix the bug' });
    expect(tracker.get('a')?.resumable).toBe(true);
    expect(changes.at(-1)?.resumable).toBe(true);
    tracker.applyHookEvent('a', { hook_event_name: 'Stop' });
    exit('a');
    expect(tracker.get('a')).toMatchObject({ state: 'ended', resumable: true });
  });

  // plan-session_list_improvements/REQ-2: a resumed session has a saved conversation from the start
  it('is true from the start for a session tracked with resumedFrom.sessionId', () => {
    trackNew('a', { sessionId: 'claude-old', firstUserMessage: 'Old prompt' });
    expect(tracker.get('a')?.resumable).toBe(true);
    expect(changes[0]?.resumable).toBe(true);
    exit('a');
    expect(tracker.get('a')).toMatchObject({ state: 'ended', resumable: true });
  });

  // plan-session_list_improvements/REQ-2: events other than UserPromptSubmit do not save a conversation
  it('stays absent after hook events that are not UserPromptSubmit', () => {
    trackNew('a');
    tracker.applyHookEvent('a', { hook_event_name: 'PreToolUse', tool_name: 'Bash' });
    tracker.applyHookEvent('a', { hook_event_name: 'Stop' });
    tracker.applyHookEvent('a', { hook_event_name: 'Notification', notification_type: 'permission_prompt' });
    expect(tracker.get('a')).not.toHaveProperty('resumable');
  });
});
