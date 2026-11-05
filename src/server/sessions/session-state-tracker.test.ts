import { beforeEach, describe, expect, it } from 'vitest';
import { type HookEvent, type SessionSummary, SessionStateTracker } from './session-state-tracker.js';

class FakeSession {
  readonly #exitListeners: (() => void)[] = [];

  constructor(
    readonly id: string,
    readonly cwd: string,
  ) {}

  onExit(listener: () => void): () => void {
    this.#exitListeners.push(listener);
    return () => {};
  }

  exit(): void {
    for (const listener of this.#exitListeners) listener();
  }
}

let clock: Date;
let tracker: SessionStateTracker;
let changes: SessionSummary[];

const at = (iso: string) => {
  clock = new Date(iso);
};

function trackNew(id = 's1', cwd = '/home/dev/projects/shop-api'): FakeSession {
  const session = new FakeSession(id, cwd);
  tracker.track(session);
  return session;
}

const hook = (name: string, fields: Omit<HookEvent, 'hook_event_name'> = {}): HookEvent => ({ hook_event_name: name, ...fields });
const state = (id = 's1') => tracker.get(id)?.state;

beforeEach(() => {
  at('2026-11-05T10:00:00.000Z');
  tracker = new SessionStateTracker({ now: () => clock });
  changes = [];
  tracker.onChange((summary) => changes.push(summary));
});

describe('SessionStateTracker.track', () => {
  // plan-claude_sessions_client/REQ-14, REQ-12: a new session is idle, labelled by its folder, active now
  it('adds the session idle, with the folder name as label and last activity now, and notifies it', () => {
    trackNew('s1', '/home/dev/projects/shop-api');
    const expected = {
      id: 's1',
      folder: '/home/dev/projects/shop-api',
      label: 'shop-api',
      state: 'idle',
      lastActivity: '2026-11-05T10:00:00.000Z',
    };
    expect(tracker.get('s1')).toEqual(expected);
    expect(changes).toEqual([expected]);
  });

  // plan-claude_sessions_client/REQ-14: process exit sets ended
  it('sets ended with last activity now when the process exits, and notifies it', () => {
    const session = trackNew();
    at('2026-11-05T10:05:00.000Z');
    session.exit();
    expect(tracker.get('s1')).toMatchObject({ state: 'ended', lastActivity: '2026-11-05T10:05:00.000Z' });
    expect(changes.at(-1)).toMatchObject({ id: 's1', state: 'ended' });
  });
});

describe('SessionStateTracker.applyHookEvent: event to state', () => {
  const cases: [string, HookEvent, SessionSummary['state'], SessionSummary['state']][] = [
    ['UserPromptSubmit', hook('UserPromptSubmit', { prompt: 'ciao' }), 'idle', 'working'],
    ['PreToolUse of a tool', hook('PreToolUse', { tool_name: 'Bash' }), 'idle', 'working'],
    ['PreToolUse of AskUserQuestion', hook('PreToolUse', { tool_name: 'AskUserQuestion' }), 'working', 'needs_input'],
    ['PostToolUse', hook('PostToolUse', { tool_name: 'Bash' }), 'needs_input', 'working'],
    ['PermissionRequest', hook('PermissionRequest', { tool_name: 'Bash' }), 'working', 'needs_input'],
    ['Notification permission_prompt', hook('Notification', { notification_type: 'permission_prompt' }), 'working', 'needs_input'],
    ['Notification elicitation_dialog', hook('Notification', { notification_type: 'elicitation_dialog' }), 'working', 'needs_input'],
    ['Notification idle_prompt', hook('Notification', { notification_type: 'idle_prompt' }), 'working', 'idle'],
    ['Stop', hook('Stop'), 'working', 'idle'],
  ];

  const enter = (target: SessionSummary['state']) => {
    if (target === 'working') tracker.applyHookEvent('s1', hook('PreToolUse', { tool_name: 'Read' }));
    if (target === 'needs_input') tracker.applyHookEvent('s1', hook('PermissionRequest'));
  };

  for (const [name, event, from, to] of cases) {
    // plan-claude_sessions_client/REQ-14: event to state table of SessionStateTracker
    it(`${name}: ${from} -> ${to}, and returns true`, () => {
      trackNew();
      enter(from);
      expect(state()).toBe(from);
      changes = [];
      expect(tracker.applyHookEvent('s1', event)).toBe(true);
      expect(state()).toBe(to);
      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({ id: 's1', state: to });
    });
  }

  // plan-claude_sessions_client/REQ-14: unknown events and notification types change nothing
  it('an unknown event or notification type changes nothing and notifies nothing, but returns true', () => {
    trackNew();
    enter('working');
    const before = tracker.get('s1');
    changes = [];
    at('2026-11-05T11:00:00.000Z');
    for (const event of [
      hook('SessionStart'),
      hook('SubagentStop'),
      hook('Notification', { notification_type: 'auth_success' }),
      hook('Notification'),
    ]) {
      expect(tracker.applyHookEvent('s1', event)).toBe(true);
    }
    expect(tracker.get('s1')).toEqual(before);
    expect(changes).toEqual([]);
  });

  // plan-claude_sessions_client/REQ-14: an unknown id is reported
  it('returns false for an unknown id', () => {
    expect(tracker.applyHookEvent('missing', hook('Stop'))).toBe(false);
    expect(changes).toEqual([]);
  });

  // plan-claude_sessions_client/REQ-12: a mapped event sets last activity and notifies even with no state change
  it('a mapped event that keeps the same state still sets last activity and notifies', () => {
    trackNew();
    enter('working');
    changes = [];
    at('2026-11-05T10:01:00.000Z');
    tracker.applyHookEvent('s1', hook('PostToolUse'));
    expect(tracker.get('s1')).toMatchObject({ state: 'working', lastActivity: '2026-11-05T10:01:00.000Z' });
    expect(changes).toHaveLength(1);
  });

  // plan-claude_sessions_client/REQ-12: idle_prompt is a correction and does not touch last activity
  it('idle_prompt does not change last activity', () => {
    trackNew();
    at('2026-11-05T10:01:00.000Z');
    enter('working');
    at('2026-11-05T10:09:00.000Z');
    tracker.applyHookEvent('s1', hook('Notification', { notification_type: 'idle_prompt' }));
    expect(tracker.get('s1')).toMatchObject({ state: 'idle', lastActivity: '2026-11-05T10:01:00.000Z' });
  });

  // plan-claude_sessions_client/REQ-14: idle_prompt on an idle session is a no-op
  it('idle_prompt on an idle session changes nothing and notifies nothing', () => {
    trackNew();
    changes = [];
    at('2026-11-05T10:09:00.000Z');
    tracker.applyHookEvent('s1', hook('Notification', { notification_type: 'idle_prompt' }));
    expect(tracker.get('s1')).toMatchObject({ state: 'idle', lastActivity: '2026-11-05T10:00:00.000Z' });
    expect(changes).toEqual([]);
  });

  // plan-claude_sessions_client/REQ-14: ended is final
  it('ignores hook events after the session ended', () => {
    const session = trackNew();
    session.exit();
    const ended = tracker.get('s1');
    changes = [];
    at('2026-11-05T12:00:00.000Z');
    expect(tracker.applyHookEvent('s1', hook('UserPromptSubmit', { prompt: 'late' }))).toBe(true);
    tracker.applyHookEvent('s1', hook('PermissionRequest'));
    expect(tracker.get('s1')).toEqual(ended);
    expect(changes).toEqual([]);
  });
});

describe('SessionStateTracker label', () => {
  // plan-claude_sessions_client/REQ-13: the first non-empty prompt becomes the label
  it('the first UserPromptSubmit with a prompt sets the label, later prompts do not', () => {
    trackNew();
    tracker.applyHookEvent('s1', hook('UserPromptSubmit', { prompt: 'Aggiungi i test del carrello' }));
    tracker.applyHookEvent('s1', hook('UserPromptSubmit', { prompt: 'Secondo messaggio' }));
    expect(tracker.get('s1')?.label).toBe('Aggiungi i test del carrello');
  });

  // plan-claude_sessions_client/REQ-13: an empty prompt keeps the folder label
  it('an empty or missing prompt does not set the label', () => {
    trackNew();
    tracker.applyHookEvent('s1', hook('UserPromptSubmit', { prompt: '' }));
    tracker.applyHookEvent('s1', hook('UserPromptSubmit'));
    expect(tracker.get('s1')?.label).toBe('shop-api');
    tracker.applyHookEvent('s1', hook('UserPromptSubmit', { prompt: 'primo vero' }));
    expect(tracker.get('s1')?.label).toBe('primo vero');
  });

  // plan-claude_sessions_client/REQ-13: whitespace collapsed, ends trimmed, 80 characters kept
  it('collapses whitespace runs, trims the ends and keeps the first 80 characters', () => {
    trackNew();
    const words = Array.from({ length: 30 }, (_, i) => `parola${i}`);
    tracker.applyHookEvent('s1', hook('UserPromptSubmit', { prompt: `  \n ${words.join(' \n\t ')}  ` }));
    expect(tracker.get('s1')?.label).toBe(words.join(' ').slice(0, 80));
  });
});

describe('SessionStateTracker.applyUserInput', () => {
  // plan-claude_sessions_client/REQ-12: user input sets last activity
  it('sets last activity and notifies', () => {
    trackNew();
    changes = [];
    at('2026-11-05T10:02:00.000Z');
    tracker.applyUserInput('s1', 'a');
    expect(tracker.get('s1')).toMatchObject({ state: 'idle', lastActivity: '2026-11-05T10:02:00.000Z' });
    expect(changes).toHaveLength(1);
  });

  for (const [key, data] of [
    ['Esc', '\x1b'],
    ['Ctrl+C', '\x03'],
  ] as const) {
    for (const from of ['working', 'needs_input'] as const) {
      // plan-claude_sessions_client/REQ-14: a lone interrupt key while busy sets idle
      it(`${key} alone while ${from} sets idle`, () => {
        trackNew();
        if (from === 'working') tracker.applyHookEvent('s1', hook('UserPromptSubmit', { prompt: 'x' }));
        else tracker.applyHookEvent('s1', hook('PermissionRequest'));
        tracker.applyUserInput('s1', data);
        expect(state()).toBe('idle');
        expect(changes.at(-1)).toMatchObject({ state: 'idle' });
      });
    }
  }

  // plan-claude_sessions_client/REQ-14: an arrow key or other input is not an interrupt
  it('longer input that starts with Esc, or other keys, do not change the state', () => {
    trackNew();
    tracker.applyHookEvent('s1', hook('PermissionRequest'));
    for (const data of ['\x1b[A', '\x1b\x1b', 'y', '\x03\x03', '\r']) tracker.applyUserInput('s1', data);
    expect(state()).toBe('needs_input');
  });

  // plan-claude_sessions_client/REQ-14: ended is final for input too
  it('changes nothing and notifies nothing after the session ended', () => {
    const session = trackNew();
    session.exit();
    const ended = tracker.get('s1');
    changes = [];
    at('2026-11-05T12:00:00.000Z');
    tracker.applyUserInput('s1', '\x1b');
    tracker.applyUserInput('s1', 'hello');
    expect(tracker.get('s1')).toEqual(ended);
    expect(changes).toEqual([]);
  });

  // plan-claude_sessions_client/REQ-14: unknown ids are ignored
  it('does nothing for an unknown id', () => {
    expect(() => tracker.applyUserInput('missing', 'x')).not.toThrow();
    expect(changes).toEqual([]);
  });
});

describe('SessionStateTracker.list and onChange', () => {
  // plan-claude_sessions_client/REQ-11, REQ-20: every session in start order, ended ones included
  it('lists every tracked session in start order, ended ones included', () => {
    trackNew('a', '/p/a');
    const b = trackNew('b', '/p/b');
    trackNew('c', '/p/c');
    b.exit();
    tracker.applyHookEvent('a', hook('Stop'));
    expect(tracker.list().map((s) => [s.id, s.state])).toEqual([
      ['a', 'idle'],
      ['b', 'ended'],
      ['c', 'idle'],
    ]);
  });

  // plan-claude_sessions_client/REQ-12: lastActivity is an ISO-8601 UTC string
  it('reports lastActivity as an ISO-8601 UTC string', () => {
    trackNew();
    expect(tracker.get('s1')?.lastActivity).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
  });

  // plan-claude_sessions_client/REQ-15: unsubscribed listeners get nothing more
  it('an unsubscribed listener is not called', () => {
    const seen: SessionSummary[] = [];
    const unsubscribe = tracker.onChange((summary) => seen.push(summary));
    trackNew();
    unsubscribe();
    tracker.applyHookEvent('s1', hook('Stop'));
    expect(seen).toHaveLength(1);
  });

  it('get returns undefined for an unknown id', () => {
    expect(tracker.get('missing')).toBeUndefined();
  });
});

describe('SessionStateTracker Claude Code session id', () => {
  const trackResumed = (id: string, resumedFrom: { sessionId: string; firstUserMessage?: string | null }, cwd = '/home/dev/projects/shop-api') => {
    const session = Object.assign(new FakeSession(id, cwd), { resumedFrom });
    tracker.track(session);
    return session;
  };

  // plan-claude_sessions_client/REQ-25
  it('takes the session_id of a hook event, the last one wins', () => {
    trackNew('s1');
    expect(tracker.liveClaudeSessionIds()).toEqual(new Set());
    tracker.applyHookEvent('s1', hook('UserPromptSubmit', { prompt: 'Ciao', session_id: 'claude-a' }));
    expect(tracker.liveClaudeSessionIds()).toEqual(new Set(['claude-a']));
    tracker.applyHookEvent('s1', hook('Stop', { session_id: 'claude-b' }));
    expect(tracker.liveClaudeSessionIds()).toEqual(new Set(['claude-b']));
  });

  it('takes it also from an event that changes no state, and notifies nothing for it', () => {
    trackNew('s1');
    changes = [];
    tracker.applyHookEvent('s1', hook('SessionStart', { session_id: 'claude-start' }));
    expect(tracker.liveClaudeSessionIds()).toEqual(new Set(['claude-start']));
    expect(changes).toEqual([]);
  });

  it('ignores an empty or non-string session_id', () => {
    trackNew('s1');
    tracker.applyHookEvent('s1', hook('Stop', { session_id: 'claude-a' }));
    tracker.applyHookEvent('s1', hook('Stop', { session_id: '' }));
    tracker.applyHookEvent('s1', hook('Stop', { session_id: 42 }));
    expect(tracker.liveClaudeSessionIds()).toEqual(new Set(['claude-a']));
  });

  it('liveClaudeSessionIds leaves out ended sessions', () => {
    trackNew('s1');
    const ended = trackNew('s2');
    tracker.applyHookEvent('s1', hook('Stop', { session_id: 'claude-live' }));
    tracker.applyHookEvent('s2', hook('Stop', { session_id: 'claude-ended' }));
    ended.exit();
    expect(tracker.liveClaudeSessionIds()).toEqual(new Set(['claude-live']));
  });

  it('a resumed session has its Claude Code session id from the start', () => {
    trackResumed('s1', { sessionId: 'past-1' });
    expect(tracker.liveClaudeSessionIds()).toEqual(new Set(['past-1']));
  });

  // plan-claude_sessions_client/REQ-13
  it('a resumed session takes its first user message as label, with the label rule, and keeps it', () => {
    trackResumed('s1', { sessionId: 'past-1', firstUserMessage: `  Correggi\n\til   bug ${'y'.repeat(100)}` });
    const label = `Correggi il bug ${'y'.repeat(64)}`;
    expect(tracker.get('s1')?.label).toBe(label);
    expect(changes.at(-1)?.label).toBe(label);
    tracker.applyHookEvent('s1', hook('UserPromptSubmit', { prompt: 'Nuovo messaggio' }));
    expect(tracker.get('s1')?.label).toBe(label);
  });

  it.each([undefined, null, '   '])('a resumed session with first user message %j is labelled by its folder until the first prompt', (firstUserMessage) => {
    trackResumed('s1', { sessionId: 'past-1', firstUserMessage }, '/home/dev/projects/shop-api');
    expect(tracker.get('s1')?.label).toBe('shop-api');
    tracker.applyHookEvent('s1', hook('UserPromptSubmit', { prompt: 'Nuovo messaggio' }));
    expect(tracker.get('s1')?.label).toBe('Nuovo messaggio');
  });
});

describe('SessionStateTracker waiting tool', () => {
  const waitingTool = (id = 's1') => tracker.get(id)?.waitingTool;
  const permissionPrompt = hook('Notification', { notification_type: 'permission_prompt' });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-22: PermissionRequest gives its tool_name as waiting tool
  it('takes the tool_name of a PermissionRequest and notifies it', () => {
    trackNew();
    tracker.applyHookEvent('s1', hook('PermissionRequest', { tool_name: 'Bash' }));
    expect(state()).toBe('needs_input');
    expect(waitingTool()).toBe('Bash');
    expect(changes.at(-1)?.waitingTool).toBe('Bash');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-22: permission_prompt takes the last PreToolUse tool
  it('takes the last PreToolUse tool on a permission_prompt', () => {
    trackNew();
    tracker.applyHookEvent('s1', hook('PreToolUse', { tool_name: 'Read' }));
    tracker.applyHookEvent('s1', hook('PreToolUse', { tool_name: 'Edit' }));
    expect(waitingTool()).toBeUndefined();
    tracker.applyHookEvent('s1', permissionPrompt);
    expect(waitingTool()).toBe('Edit');
  });

  // session-state-tracker spec: permission_prompt keeps a waiting tool already set
  it('keeps the PermissionRequest tool on a later permission_prompt', () => {
    trackNew();
    tracker.applyHookEvent('s1', hook('PreToolUse', { tool_name: 'Read' }));
    tracker.applyHookEvent('s1', hook('PermissionRequest', { tool_name: 'Bash' }));
    tracker.applyHookEvent('s1', permissionPrompt);
    expect(waitingTool()).toBe('Bash');
  });

  // session-state-tracker spec: no known tool gives no waiting tool
  it('has no waiting tool on a permission_prompt with no PreToolUse before', () => {
    trackNew();
    tracker.applyHookEvent('s1', permissionPrompt);
    expect(state()).toBe('needs_input');
    expect(tracker.get('s1')).not.toHaveProperty('waitingTool');
  });

  // session-state-tracker spec: an empty tool_name is not remembered
  it('ignores an empty tool_name', () => {
    trackNew();
    tracker.applyHookEvent('s1', hook('PermissionRequest', { tool_name: '' }));
    expect(waitingTool()).toBeUndefined();
  });

  // session-state-tracker spec: AskUserQuestion and elicitation_dialog give no waiting tool
  it('gives no waiting tool for AskUserQuestion or an elicitation_dialog', () => {
    trackNew('ask');
    tracker.applyHookEvent('ask', hook('PreToolUse', { tool_name: 'AskUserQuestion' }));
    expect(state('ask')).toBe('needs_input');
    expect(waitingTool('ask')).toBeUndefined();
    trackNew('elicit');
    tracker.applyHookEvent('elicit', hook('Notification', { notification_type: 'elicitation_dialog' }));
    expect(state('elicit')).toBe('needs_input');
    expect(waitingTool('elicit')).toBeUndefined();
  });

  // session-state-tracker spec: another event that keeps needs_input leaves the waiting tool unchanged
  it('keeps the waiting tool on another event that keeps needs_input', () => {
    trackNew();
    tracker.applyHookEvent('s1', hook('PermissionRequest', { tool_name: 'Bash' }));
    tracker.applyHookEvent('s1', hook('Notification', { notification_type: 'elicitation_dialog' }));
    expect(waitingTool()).toBe('Bash');
  });

  // session-state-tracker spec: the waiting tool goes away when the state leaves needs_input, by event, input or exit
  it('removes the waiting tool when the state leaves needs_input', () => {
    trackNew('event');
    tracker.applyHookEvent('event', hook('PermissionRequest', { tool_name: 'Bash' }));
    tracker.applyHookEvent('event', hook('PostToolUse', { tool_name: 'Bash' }));
    expect(state('event')).toBe('working');
    expect(tracker.get('event')).not.toHaveProperty('waitingTool');
    expect(changes.at(-1)).not.toHaveProperty('waitingTool');

    trackNew('input');
    tracker.applyHookEvent('input', hook('PermissionRequest', { tool_name: 'Bash' }));
    tracker.applyUserInput('input', '\x1b');
    expect(state('input')).toBe('idle');
    expect(tracker.get('input')).not.toHaveProperty('waitingTool');

    const exiting = trackNew('exit');
    tracker.applyHookEvent('exit', hook('PermissionRequest', { tool_name: 'Bash' }));
    exiting.exit();
    expect(state('exit')).toBe('ended');
    expect(tracker.get('exit')).not.toHaveProperty('waitingTool');
  });

  // session-state-tracker spec: an old PermissionRequest tool does not come back on a later permission_prompt
  it('uses the newest PreToolUse tool, not an old waiting tool, on a new permission_prompt', () => {
    trackNew();
    tracker.applyHookEvent('s1', hook('PermissionRequest', { tool_name: 'Bash' }));
    tracker.applyHookEvent('s1', hook('PostToolUse', { tool_name: 'Bash' }));
    tracker.applyHookEvent('s1', hook('PreToolUse', { tool_name: 'Write' }));
    tracker.applyHookEvent('s1', permissionPrompt);
    expect(waitingTool()).toBe('Write');
  });
});
