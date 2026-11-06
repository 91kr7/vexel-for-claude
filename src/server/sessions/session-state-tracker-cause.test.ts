// SessionStateTracker: the cause given to change listeners and the Claude Code session id (batch turn-end-notification).
import { describe, expect, it } from 'vitest';
import { type ChangeCause, type SessionSummary, SessionStateTracker } from './session-state-tracker.js';

function fakeSession(id: string, resumedFrom?: { sessionId: string; firstUserMessage?: string | null }) {
  const exitListeners: (() => void)[] = [];
  return {
    id,
    cwd: '/projects/ai-client',
    resumedFrom,
    onExit(listener: () => void) {
      exitListeners.push(listener);
    },
    exit() {
      for (const listener of exitListeners) listener();
    },
  };
}

function setup() {
  const tracker = new SessionStateTracker();
  const changes: [SessionSummary, ChangeCause][] = [];
  tracker.onChange((summary, cause) => changes.push([summary, cause]));
  const causes = () => changes.map(([, cause]) => cause);
  return { tracker, changes, causes };
}

describe('SessionStateTracker change cause', () => {
  it('gives { type: "track" } for a new session', () => {
    const { tracker, causes } = setup();
    tracker.track(fakeSession('h1'));
    expect(causes()).toEqual([{ type: 'track' }]);
  });

  // plan-session_notifications/REQ-14: a turn end of a hosted session is told apart by the hook "Stop"
  it('gives the hook event name of each hook event that changes the session', () => {
    const { tracker, changes, causes } = setup();
    tracker.track(fakeSession('h1'));
    changes.length = 0;

    tracker.applyHookEvent('h1', { hook_event_name: 'UserPromptSubmit', prompt: 'Fix the login form' });
    tracker.applyHookEvent('h1', { hook_event_name: 'PreToolUse', tool_name: 'Bash' });
    tracker.applyHookEvent('h1', { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
    tracker.applyHookEvent('h1', { hook_event_name: 'PostToolUse' });
    tracker.applyHookEvent('h1', { hook_event_name: 'Stop' });

    expect(causes()).toEqual([
      { type: 'hook', hookEventName: 'UserPromptSubmit' },
      { type: 'hook', hookEventName: 'PreToolUse' },
      { type: 'hook', hookEventName: 'PermissionRequest' },
      { type: 'hook', hookEventName: 'PostToolUse' },
      { type: 'hook', hookEventName: 'Stop' },
    ]);
    expect(changes.at(-1)?.[0].state).toBe('idle');
  });

  // plan-session_notifications/REQ-14: idle from idle_prompt is a correction, not a turn end
  it('gives the hook "Notification" when idle_prompt makes a working session idle', () => {
    const { tracker, changes } = setup();
    tracker.track(fakeSession('h1'));
    tracker.applyHookEvent('h1', { hook_event_name: 'UserPromptSubmit', prompt: 'Fix it' });
    changes.length = 0;

    tracker.applyHookEvent('h1', { hook_event_name: 'Notification', notification_type: 'idle_prompt' });

    expect(changes).toEqual([[expect.objectContaining({ state: 'idle' }), { type: 'hook', hookEventName: 'Notification' }]]);
  });

  // plan-session_notifications/REQ-15: idle from Esc or Ctrl+C is an interrupt
  it('gives { type: "input" } for user input, an interrupt included', () => {
    const { tracker, changes } = setup();
    tracker.track(fakeSession('h1'));
    tracker.track(fakeSession('h2'));
    tracker.applyHookEvent('h1', { hook_event_name: 'UserPromptSubmit', prompt: 'One' });
    tracker.applyHookEvent('h2', { hook_event_name: 'UserPromptSubmit', prompt: 'Two' });
    changes.length = 0;

    tracker.applyUserInput('h1', 'a');
    tracker.applyUserInput('h1', '\x1b');
    tracker.applyUserInput('h2', '\x03');

    expect(changes).toEqual([
      [expect.objectContaining({ id: 'h1', state: 'working' }), { type: 'input' }],
      [expect.objectContaining({ id: 'h1', state: 'idle' }), { type: 'input' }],
      [expect.objectContaining({ id: 'h2', state: 'idle' }), { type: 'input' }],
    ]);
  });

  it('gives { type: "exit" } when the session process exits', () => {
    const { tracker, changes } = setup();
    const session = fakeSession('h1');
    tracker.track(session);
    tracker.applyHookEvent('h1', { hook_event_name: 'UserPromptSubmit', prompt: 'Fix it' });
    changes.length = 0;

    session.exit();

    expect(changes).toEqual([[expect.objectContaining({ state: 'ended' }), { type: 'exit' }]]);
  });
});

describe('SessionStateTracker.claudeSessionId', () => {
  it('is undefined for an unknown session and for a session with no known id', () => {
    const { tracker } = setup();
    tracker.track(fakeSession('h1'));
    expect(tracker.claudeSessionId('nope')).toBeUndefined();
    expect(tracker.claudeSessionId('h1')).toBeUndefined();
  });

  it('is the id of the resumed session', () => {
    const { tracker } = setup();
    tracker.track(fakeSession('h1', { sessionId: 'resumed-id', firstUserMessage: 'Old prompt' }));
    expect(tracker.claudeSessionId('h1')).toBe('resumed-id');
  });

  it('is the session_id of the last hook event that has one', () => {
    const { tracker } = setup();
    tracker.track(fakeSession('h1', { sessionId: 'resumed-id' }));

    tracker.applyHookEvent('h1', { hook_event_name: 'UserPromptSubmit', prompt: 'Fix it', session_id: 'first-id' });
    expect(tracker.claudeSessionId('h1')).toBe('first-id');
    tracker.applyHookEvent('h1', { hook_event_name: 'Stop', session_id: 'second-id' });
    expect(tracker.claudeSessionId('h1')).toBe('second-id');
  });

  it('ignores an empty or non-string session_id', () => {
    const { tracker } = setup();
    tracker.track(fakeSession('h1'));
    tracker.applyHookEvent('h1', { hook_event_name: 'UserPromptSubmit', prompt: 'Fix it', session_id: 'kept-id' });

    tracker.applyHookEvent('h1', { hook_event_name: 'PostToolUse', session_id: '' });
    tracker.applyHookEvent('h1', { hook_event_name: 'Stop', session_id: 42 });

    expect(tracker.claudeSessionId('h1')).toBe('kept-id');
  });

  it('takes the id also from an event that changes no state, and notifies nothing for it', () => {
    const { tracker, changes } = setup();
    tracker.track(fakeSession('h1'));
    changes.length = 0;

    tracker.applyHookEvent('h1', { hook_event_name: 'SessionStart', session_id: 'start-id' });

    expect(tracker.claudeSessionId('h1')).toBe('start-id');
    expect(changes).toEqual([]);
  });
});
