import { describe, expect, it } from 'vitest';
import type { ExternalSessionChange, ExternalSessionSummary } from '../external/external-session-scanner.js';
import { type AttentionEvent, type AttentionSession, AttentionMonitor } from './attention-monitor.js';
import type { ChangeCause, SessionState, SessionSummary } from './session-state-tracker.js';
import type { LastTurn } from './turn-reader.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class FakeTracker {
  private readonly sessions = new Map<string, SessionSummary>();
  private readonly listeners = new Set<(summary: SessionSummary, cause?: ChangeCause) => void>();
  readonly claudeIds = new Map<string, string>();

  list(): SessionSummary[] {
    return [...this.sessions.values()];
  }

  claudeSessionId(id: string): string | undefined {
    return this.claudeIds.get(id);
  }

  onChange(listener: (summary: SessionSummary, cause?: ChangeCause) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Stores the summary without notifying: a session tracked before the monitor exists. */
  seed(summary: SessionSummary): void {
    this.sessions.set(summary.id, summary);
  }

  /** Stores the summary and notifies it, as the tracker does after every change. */
  set(summary: SessionSummary, cause?: ChangeCause): void {
    this.sessions.set(summary.id, summary);
    for (const listener of this.listeners) listener(summary, cause);
  }
}

class FakeScanner {
  private readonly sessions = new Map<string, ExternalSessionSummary>();
  private readonly listeners = new Set<(change: ExternalSessionChange) => void>();

  list(): ExternalSessionSummary[] {
    return [...this.sessions.values()];
  }

  onChange(listener: (change: ExternalSessionChange) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  seed(session: ExternalSessionSummary): void {
    this.sessions.set(session.id, session);
  }

  set(session: ExternalSessionSummary): void {
    this.sessions.set(session.id, session);
    for (const listener of this.listeners) listener({ type: 'session', session });
  }

  remove(id: string): void {
    this.sessions.delete(id);
    for (const listener of this.listeners) listener({ type: 'session-removed', id });
  }
}

const hosted = (id: string, state: SessionState, extra: Partial<SessionSummary> = {}): SessionSummary => ({
  id,
  folder: '/projects/ai-client',
  label: 'Fix the login form',
  state,
  lastActivity: '2026-11-06T10:00:00.000Z',
  ...extra,
});

const external = (
  id: string,
  state: ExternalSessionSummary['state'],
  extra: Partial<ExternalSessionSummary> = {},
): ExternalSessionSummary => ({
  id,
  folder: '/projects/billing',
  label: 'Review the invoices',
  state,
  lastActivity: '2026-11-06T10:00:00.000Z',
  external: true,
  ...extra,
});

/** Transcript reads that the test finishes: each read waits until the test resolves or rejects it. */
class FakeTurns {
  readonly reads: { folder: string; claudeSessionId: string; resolve(turn: LastTurn): void; reject(error: Error): void }[] = [];

  lastTurn(folder: string, claudeSessionId: string): Promise<LastTurn> {
    return new Promise((resolve, reject) => this.reads.push({ folder, claudeSessionId, resolve, reject }));
  }

  read(index = 0) {
    const read = this.reads[index];
    if (!read) throw new Error(`no transcript read #${index}`);
    return read;
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
  const tracker = new FakeTracker();
  const scanner = new FakeScanner();
  const turns = new FakeTurns();
  const start = () => {
    const monitor = new AttentionMonitor({ tracker, scanner, turns });
    const events: AttentionEvent[] = [];
    const lists: AttentionSession[][] = [];
    monitor.onEvent((event) => events.push(event));
    monitor.onNeedsInputChange((sessions) => lists.push(sessions));
    return { monitor, events, lists };
  };
  return { tracker, scanner, turns, start };
}

describe('AttentionMonitor events', () => {
  // plan-session_notifications/REQ-1, REQ-7, REQ-8
  it('gives one needs_input event when a known hosted session enters needs_input, with its folder, label and waiting tool', () => {
    const { tracker, start } = setup();
    tracker.seed(hosted('h1', 'working'));
    const { events } = start();

    tracker.set(hosted('h1', 'needs_input', { waitingTool: 'Bash' }));

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      id: expect.stringMatching(UUID),
      sessionId: 'h1',
      kind: 'needs_input',
      folder: '/projects/ai-client',
      label: 'Fix the login form',
      waitingTool: 'Bash',
    });
  });

  // plan-session_notifications/REQ-1
  it('gives an event when a hosted session first seen after start goes from idle to needs_input', () => {
    const { tracker, start } = setup();
    const { events } = start();

    tracker.set(hosted('h1', 'idle'));
    expect(events).toEqual([]);
    tracker.set(hosted('h1', 'needs_input', { waitingTool: 'Edit' }));

    expect(events.map((event) => [event.sessionId, event.waitingTool])).toEqual([['h1', 'Edit']]);
  });

  // plan-session_notifications/REQ-1, REQ-7
  it('gives an event with no waiting tool when a known external session enters needs_input', () => {
    const { scanner, start } = setup();
    scanner.seed(external('e1', 'working'));
    const { events } = start();

    scanner.set(external('e1', 'needs_input'));

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      id: expect.stringMatching(UUID),
      sessionId: 'e1',
      kind: 'needs_input',
      folder: '/projects/billing',
      label: 'Review the invoices',
    });
    expect(events[0]).not.toHaveProperty('waitingTool');
  });

  // plan-session_notifications/REQ-9: no tool known in the tracker summary, none in the event
  it('has no waitingTool when the tracker summary has none', () => {
    const { tracker, start } = setup();
    tracker.seed(hosted('h1', 'working'));
    const { events } = start();

    tracker.set(hosted('h1', 'needs_input'));

    expect(events).toHaveLength(1);
    expect(events[0]).not.toHaveProperty('waitingTool');
  });

  // plan-session_notifications/REQ-5: first sight is not a transition
  it('gives no event for a hosted session first seen in needs_input', () => {
    const { tracker, start } = setup();
    const { events } = start();

    tracker.set(hosted('h1', 'needs_input', { waitingTool: 'Bash' }));

    expect(events).toEqual([]);
  });

  // plan-session_notifications/REQ-5
  it('gives no event for an external session that a scan adds in needs_input', () => {
    const { scanner, start } = setup();
    const { events } = start();

    scanner.set(external('e1', 'needs_input'));

    expect(events).toEqual([]);
  });

  // plan-session_notifications/REQ-5: the sessions listed at start count as seen
  it('gives no event for the sessions already in needs_input at start', () => {
    const { tracker, scanner, start } = setup();
    tracker.seed(hosted('h1', 'needs_input', { waitingTool: 'Bash' }));
    scanner.seed(external('e1', 'needs_input'));
    const { events } = start();

    tracker.set(hosted('h1', 'needs_input', { waitingTool: 'Bash', lastActivity: '2026-11-06T10:05:00.000Z' }));
    scanner.set(external('e1', 'needs_input', { lastActivity: '2026-11-06T10:05:00.000Z' }));

    expect(events).toEqual([]);
  });

  // plan-session_notifications/REQ-6: the tracker notifies also when the state does not change
  it('gives no second event while a session stays in needs_input', () => {
    const { tracker, scanner, start } = setup();
    tracker.seed(hosted('h1', 'working'));
    scanner.seed(external('e1', 'idle'));
    const { events } = start();

    tracker.set(hosted('h1', 'needs_input'));
    tracker.set(hosted('h1', 'needs_input', { waitingTool: 'Bash' }));
    tracker.set(hosted('h1', 'needs_input', { waitingTool: 'Bash', lastActivity: '2026-11-06T10:05:00.000Z' }));
    scanner.set(external('e1', 'needs_input'));
    scanner.set(external('e1', 'needs_input', { lastActivity: '2026-11-06T10:05:00.000Z' }));

    expect(events.map((event) => event.sessionId)).toEqual(['h1', 'e1']);
  });

  it('gives a new random UUID to each event', () => {
    const { tracker, start } = setup();
    tracker.seed(hosted('h1', 'working'));
    const { events } = start();

    tracker.set(hosted('h1', 'needs_input'));
    tracker.set(hosted('h1', 'working'));
    tracker.set(hosted('h1', 'needs_input'));

    expect(events).toHaveLength(2);
    expect(events[0]?.id).toMatch(UUID);
    expect(events[1]?.id).toMatch(UUID);
    expect(events[0]?.id).not.toBe(events[1]?.id);
  });

  // plan-session_notifications/REQ-7
  it('takes the folder and the label of the session at the time of the event', () => {
    const { tracker, start } = setup();
    tracker.seed(hosted('h1', 'idle', { label: 'ai-client' }));
    const { events } = start();

    tracker.set(hosted('h1', 'working', { label: 'Fix the login form' }));
    tracker.set(hosted('h1', 'needs_input', { label: 'Fix the login form' }));

    expect(events[0]).toMatchObject({ folder: '/projects/ai-client', label: 'Fix the login form' });
  });

  it('forgets a session that the scanner removes: when it comes back, that is a first sight', () => {
    const { scanner, start } = setup();
    scanner.seed(external('e1', 'working'));
    const { events } = start();

    scanner.remove('e1');
    scanner.set(external('e1', 'needs_input'));
    expect(events).toEqual([]);

    scanner.set(external('e1', 'working'));
    scanner.set(external('e1', 'needs_input'));
    expect(events.map((event) => event.sessionId)).toEqual(['e1']);
  });

  it('keeps no history: a listener added after an event gets nothing', () => {
    const { tracker, start } = setup();
    tracker.seed(hosted('h1', 'working'));
    const { monitor } = start();
    tracker.set(hosted('h1', 'needs_input'));

    const late: AttentionEvent[] = [];
    monitor.onEvent((event) => late.push(event));

    expect(late).toEqual([]);
  });

  it('stops calling an event listener after unsubscribe', () => {
    const { tracker, scanner, turns } = setup();
    tracker.seed(hosted('h1', 'working'));
    const monitor = new AttentionMonitor({ tracker, scanner, turns });
    const events: AttentionEvent[] = [];
    const unsubscribe = monitor.onEvent((event) => events.push(event));

    unsubscribe();
    tracker.set(hosted('h1', 'needs_input'));

    expect(events).toEqual([]);
  });
});

describe('AttentionMonitor needs-input list', () => {
  // plan-session_notifications/REQ-11: the list holds hosted and external sessions, first sight included
  it('lists the hosted and external sessions in needs_input, in the order they entered it', () => {
    const { tracker, scanner, start } = setup();
    tracker.seed(hosted('h1', 'needs_input', { folder: '/projects/one', label: 'One' }));
    scanner.seed(external('e1', 'working', { folder: '/projects/two', label: 'Two' }));
    const { monitor } = start();

    scanner.set(external('e1', 'needs_input', { folder: '/projects/two', label: 'Two' }));
    tracker.set(hosted('h2', 'needs_input', { folder: '/projects/three', label: 'Three' }));

    expect(monitor.needsInput()).toEqual([
      { sessionId: 'h1', folder: '/projects/one', label: 'One' },
      { sessionId: 'e1', folder: '/projects/two', label: 'Two' },
      { sessionId: 'h2', folder: '/projects/three', label: 'Three' },
    ]);
  });

  it('returns a copy of the list', () => {
    const { tracker, start } = setup();
    tracker.seed(hosted('h1', 'needs_input'));
    const { monitor } = start();

    const copy = monitor.needsInput();
    copy.pop();

    expect(monitor.needsInput().map((session) => session.sessionId)).toEqual(['h1']);
  });

  // plan-session_notifications/REQ-11
  it('removes a session whose state becomes another one, ended included', () => {
    const { tracker, scanner, start } = setup();
    tracker.seed(hosted('h1', 'needs_input'));
    tracker.seed(hosted('h2', 'needs_input'));
    tracker.seed(hosted('h3', 'needs_input'));
    scanner.seed(external('e1', 'needs_input'));
    scanner.seed(external('e2', 'needs_input'));
    const { monitor } = start();
    expect(monitor.needsInput()).toHaveLength(5);

    tracker.set(hosted('h1', 'idle'));
    tracker.set(hosted('h2', 'working'));
    tracker.set(hosted('h3', 'ended'));
    scanner.set(external('e1', 'working'));
    scanner.set(external('e2', 'idle'));

    expect(monitor.needsInput()).toEqual([]);
  });

  // plan-session_notifications/REQ-11
  it('removes an external session that the scanner removes', () => {
    const { scanner, start } = setup();
    scanner.seed(external('e1', 'needs_input'));
    const { monitor, lists } = start();

    scanner.remove('e1');

    expect(monitor.needsInput()).toEqual([]);
    expect(lists).toEqual([[]]);
  });

  it('calls the list listeners with the new list each time a session enters or leaves it', () => {
    const { tracker, scanner, start } = setup();
    tracker.seed(hosted('h1', 'working', { folder: '/p/a', label: 'A' }));
    const { lists } = start();

    tracker.set(hosted('h1', 'needs_input', { folder: '/p/a', label: 'A' }));
    scanner.set(external('e1', 'needs_input', { folder: '/p/b', label: 'B' }));
    tracker.set(hosted('h1', 'idle', { folder: '/p/a', label: 'A' }));

    expect(lists).toEqual([
      [{ sessionId: 'h1', folder: '/p/a', label: 'A' }],
      [
        { sessionId: 'h1', folder: '/p/a', label: 'A' },
        { sessionId: 'e1', folder: '/p/b', label: 'B' },
      ],
      [{ sessionId: 'e1', folder: '/p/b', label: 'B' }],
    ]);
  });

  it('calls the list listeners when the folder or the label of a listed session changes', () => {
    const { tracker, scanner, start } = setup();
    tracker.seed(hosted('h1', 'needs_input', { folder: '/p/a', label: 'A' }));
    scanner.seed(external('e1', 'needs_input', { folder: '/p/b', label: 'b' }));
    const { lists } = start();

    tracker.set(hosted('h1', 'needs_input', { folder: '/p/a', label: 'A renamed' }));
    scanner.set(external('e1', 'needs_input', { folder: '/p/b', label: 'First message' }));

    // The spec gives no order between two sessions already waiting at start.
    const byId = (sessions: AttentionSession[]) => [...sessions].sort((a, b) => a.sessionId.localeCompare(b.sessionId));
    expect(lists.map(byId)).toEqual([
      [
        { sessionId: 'e1', folder: '/p/b', label: 'b' },
        { sessionId: 'h1', folder: '/p/a', label: 'A renamed' },
      ],
      [
        { sessionId: 'e1', folder: '/p/b', label: 'First message' },
        { sessionId: 'h1', folder: '/p/a', label: 'A renamed' },
      ],
    ]);
  });

  it('calls no list listener for changes that do not change the list', () => {
    const { tracker, scanner, start } = setup();
    tracker.seed(hosted('h1', 'needs_input'));
    tracker.seed(hosted('h2', 'working'));
    scanner.seed(external('e1', 'working'));
    const { lists } = start();

    tracker.set(hosted('h1', 'needs_input', { lastActivity: '2026-11-06T10:05:00.000Z' }));
    tracker.set(hosted('h1', 'needs_input', { waitingTool: 'Bash', lastActivity: '2026-11-06T10:06:00.000Z' }));
    tracker.set(hosted('h2', 'working', { label: 'Another label' }));
    tracker.set(hosted('h3', 'idle'));
    scanner.set(external('e1', 'idle'));
    scanner.set(external('e2', 'working'));
    scanner.remove('e2');

    expect(lists).toEqual([]);
  });

  it('calls the list listeners before the event listeners when one change does both', () => {
    const { tracker, scanner, turns } = setup();
    tracker.seed(hosted('h1', 'working'));
    const monitor = new AttentionMonitor({ tracker, scanner, turns });
    const calls: string[] = [];
    monitor.onEvent(() => calls.push('event'));
    monitor.onNeedsInputChange(() => calls.push('list'));

    tracker.set(hosted('h1', 'needs_input'));

    expect(calls).toEqual(['list', 'event']);
  });

  it('stops calling a list listener after unsubscribe', () => {
    const { tracker, scanner, turns } = setup();
    tracker.seed(hosted('h1', 'working'));
    const monitor = new AttentionMonitor({ tracker, scanner, turns });
    const lists: AttentionSession[][] = [];
    const unsubscribe = monitor.onNeedsInputChange((sessions) => lists.push(sessions));

    unsubscribe();
    tracker.set(hosted('h1', 'needs_input'));

    expect(lists).toEqual([]);
  });
});

const STOP: ChangeCause = { type: 'hook', hookEventName: 'Stop' };

describe('AttentionMonitor turn-end events of hosted sessions', () => {
  // plan-session_notifications/REQ-14, REQ-16
  it('gives one turn_end event after the transcript read, with the plain excerpt of the final response', async () => {
    const { tracker, turns, start } = setup();
    tracker.seed(hosted('h1', 'working'));
    tracker.claudeIds.set('h1', 'claude-1');
    const { events, lists } = start();

    tracker.set(hosted('h1', 'idle'), STOP);
    expect(events).toEqual([]);
    expect(turns.reads.map((read) => [read.folder, read.claudeSessionId])).toEqual([['/projects/ai-client', 'claude-1']]);

    turns.read().resolve({ interrupted: false, finalResponse: '**Done.** The tests pass.' });
    await settle();

    expect(events).toEqual([
      {
        id: expect.stringMatching(UUID),
        sessionId: 'h1',
        kind: 'turn_end',
        folder: '/projects/ai-client',
        label: 'Fix the login form',
        excerpt: 'Done. The tests pass.',
      },
    ]);
    expect(lists).toEqual([]);
  });

  // plan-session_notifications/REQ-17
  it('reads nothing and gives an event with no excerpt when no Claude Code session id is known', async () => {
    const { tracker, turns, start } = setup();
    tracker.seed(hosted('h1', 'working'));
    const { events } = start();

    tracker.set(hosted('h1', 'idle'), STOP);
    await settle();

    expect(turns.reads).toEqual([]);
    expect(events).toEqual([expect.objectContaining({ sessionId: 'h1', kind: 'turn_end' })]);
    expect(events[0]).not.toHaveProperty('excerpt');
  });

  // plan-session_notifications/REQ-15
  it('gives no event when the transcript shows an interrupt', async () => {
    const { tracker, turns, start } = setup();
    tracker.seed(hosted('h1', 'working'));
    tracker.claudeIds.set('h1', 'claude-1');
    const { events } = start();

    tracker.set(hosted('h1', 'idle'), STOP);
    turns.read().resolve({ interrupted: true });
    await settle();

    expect(events).toEqual([]);
  });

  // plan-session_notifications/REQ-15: Esc or Ctrl+C in the session
  it('gives no event when the session becomes idle by user input', async () => {
    const { tracker, turns, start } = setup();
    tracker.seed(hosted('h1', 'working'));
    tracker.claudeIds.set('h1', 'claude-1');
    const { events } = start();

    tracker.set(hosted('h1', 'idle'), { type: 'input' });
    for (const read of turns.reads) read.resolve({ interrupted: false, finalResponse: 'Partial answer.' });
    await settle();

    expect(events).toEqual([]);
  });

  it('gives no event when the session becomes idle by the idle_prompt notification', async () => {
    const { tracker, turns, start } = setup();
    tracker.seed(hosted('h1', 'working'));
    tracker.claudeIds.set('h1', 'claude-1');
    const { events } = start();

    tracker.set(hosted('h1', 'idle'), { type: 'hook', hookEventName: 'Notification' });
    for (const read of turns.reads) read.resolve({ interrupted: false, finalResponse: 'Answer.' });
    await settle();

    expect(events).toEqual([]);
  });

  it('gives no event for a Stop when the session was not working, nor when it ends', async () => {
    const { tracker, turns, start } = setup();
    tracker.seed(hosted('h1', 'needs_input'));
    tracker.seed(hosted('h2', 'idle'));
    tracker.seed(hosted('h3', 'working'));
    for (const id of ['h1', 'h2', 'h3']) tracker.claudeIds.set(id, `claude-${id}`);
    const { events } = start();

    tracker.set(hosted('h1', 'idle'), STOP);
    tracker.set(hosted('h2', 'idle'), STOP);
    tracker.set(hosted('h3', 'ended'), { type: 'exit' });
    tracker.set(hosted('h4', 'idle'), STOP);
    for (const read of turns.reads) read.resolve({ interrupted: false, finalResponse: 'Answer.' });
    await settle();

    expect(events).toEqual([]);
  });

  // plan-session_notifications/REQ-6
  it('gives one event for one turn end, also when a second Stop keeps the session idle', async () => {
    const { tracker, turns, start } = setup();
    tracker.seed(hosted('h1', 'working'));
    tracker.claudeIds.set('h1', 'claude-1');
    const { events } = start();

    tracker.set(hosted('h1', 'idle'), STOP);
    tracker.set(hosted('h1', 'idle', { lastActivity: '2026-11-06T10:05:00.000Z' }), STOP);
    for (const read of turns.reads) read.resolve({ interrupted: false, finalResponse: 'Answer.' });
    await settle();

    expect(events).toHaveLength(1);
  });

  it('gives no event when the session works again while the transcript is read', async () => {
    const { tracker, turns, start } = setup();
    tracker.seed(hosted('h1', 'working'));
    tracker.claudeIds.set('h1', 'claude-1');
    const { events } = start();

    tracker.set(hosted('h1', 'idle'), STOP);
    tracker.set(hosted('h1', 'working'), { type: 'hook', hookEventName: 'UserPromptSubmit' });
    turns.read().resolve({ interrupted: false, finalResponse: 'Answer.' });
    await settle();

    expect(events).toEqual([]);
  });
});

describe('AttentionMonitor turn-end events of external sessions', () => {
  // plan-session_notifications/REQ-14, REQ-16: the transcript of an external session is its own session id
  it('reads the transcript of the session id and gives one turn_end event with the plain excerpt', async () => {
    const { scanner, turns, start } = setup();
    scanner.seed(external('e1', 'working'));
    const { events } = start();

    scanner.set(external('e1', 'idle'));
    expect(events).toEqual([]);
    expect(turns.reads.map((read) => [read.folder, read.claudeSessionId])).toEqual([['/projects/billing', 'e1']]);

    turns.read().resolve({ interrupted: false, finalResponse: `# Summary\n\n${'word '.repeat(40)}` });
    await settle();

    expect(events).toEqual([
      {
        id: expect.stringMatching(UUID),
        sessionId: 'e1',
        kind: 'turn_end',
        folder: '/projects/billing',
        label: 'Review the invoices',
        excerpt: `Summary ${'word '.repeat(40)}`.slice(0, 99) + '…',
      },
    ]);
  });

  // plan-session_notifications/REQ-15
  it('gives no event when the transcript shows an interrupt', async () => {
    const { scanner, turns, start } = setup();
    scanner.seed(external('e1', 'working'));
    const { events } = start();

    scanner.set(external('e1', 'idle'));
    turns.read().resolve({ interrupted: true });
    await settle();

    expect(events).toEqual([]);
  });

  // plan-session_notifications/REQ-17
  it('gives an event with no excerpt when the turn has no final response', async () => {
    const { scanner, turns, start } = setup();
    scanner.seed(external('e1', 'working'));
    const { events } = start();

    scanner.set(external('e1', 'idle'));
    turns.read().resolve({ interrupted: false });
    await settle();

    expect(events).toEqual([expect.objectContaining({ sessionId: 'e1', kind: 'turn_end' })]);
    expect(events[0]).not.toHaveProperty('excerpt');
  });

  // plan-session_notifications/REQ-17
  it('gives an event with no excerpt when the final response has no plain text', async () => {
    const { scanner, turns, start } = setup();
    scanner.seed(external('e1', 'working'));
    const { events } = start();

    scanner.set(external('e1', 'idle'));
    turns.read().resolve({ interrupted: false, finalResponse: '```\n```' });
    await settle();

    expect(events).toHaveLength(1);
    expect(events[0]).not.toHaveProperty('excerpt');
  });

  it('gives an event with no excerpt when the transcript read fails', async () => {
    const { scanner, turns, start } = setup();
    scanner.seed(external('e1', 'working'));
    const { events } = start();

    scanner.set(external('e1', 'idle'));
    turns.read().reject(new Error('EACCES'));
    await settle();

    expect(events).toEqual([expect.objectContaining({ sessionId: 'e1', kind: 'turn_end' })]);
    expect(events[0]).not.toHaveProperty('excerpt');
  });

  it('gives no event when the session changes state while the transcript is read', async () => {
    const { scanner, turns, start } = setup();
    scanner.seed(external('e1', 'working'));
    scanner.seed(external('e2', 'working'));
    const { events } = start();

    scanner.set(external('e1', 'idle'));
    scanner.set(external('e2', 'idle'));
    scanner.set(external('e1', 'working'));
    scanner.set(external('e2', 'needs_input'));
    turns.read(0).resolve({ interrupted: false, finalResponse: 'Answer.' });
    turns.read(1).resolve({ interrupted: false, finalResponse: 'Answer.' });
    await settle();

    expect(events.filter((event) => event.kind === 'turn_end')).toEqual([]);
  });

  it('gives no event when the scanner removes the session while the transcript is read', async () => {
    const { scanner, turns, start } = setup();
    scanner.seed(external('e1', 'working'));
    const { events } = start();

    scanner.set(external('e1', 'idle'));
    scanner.remove('e1');
    turns.read().resolve({ interrupted: false, finalResponse: 'Answer.' });
    await settle();

    expect(events).toEqual([]);
  });

  // plan-session_notifications/REQ-7: folder and label at the time of the state change
  it('keeps the folder and the label of the state change when only the label changes during the read', async () => {
    const { scanner, turns, start } = setup();
    scanner.seed(external('e1', 'working'));
    const { events } = start();

    scanner.set(external('e1', 'idle'));
    scanner.set(external('e1', 'idle', { label: 'A later label', lastActivity: '2026-11-06T10:05:00.000Z' }));
    turns.read().resolve({ interrupted: false, finalResponse: 'Answer.' });
    await settle();

    expect(events).toEqual([expect.objectContaining({ sessionId: 'e1', kind: 'turn_end', label: 'Review the invoices', excerpt: 'Answer.' })]);
  });

  // plan-session_notifications/REQ-5
  it('gives no event for an external session first seen idle', async () => {
    const { scanner, turns, start } = setup();
    const { events } = start();

    scanner.set(external('e1', 'idle'));
    for (const read of turns.reads) read.resolve({ interrupted: false, finalResponse: 'Answer.' });
    await settle();

    expect(events).toEqual([]);
  });
});

interface ProcessEnd {
  exitCode: number | undefined;
  signal: number | undefined;
  stopRequested: boolean;
}

class FakeRegistry {
  readonly sessions = new Map<string, ProcessEnd>();

  get(id: string): ProcessEnd | undefined {
    return this.sessions.get(id);
  }

  end(id: string, end: Partial<ProcessEnd>): void {
    this.sessions.set(id, { exitCode: undefined, signal: undefined, stopRequested: false, ...end });
  }
}

const EXIT: ChangeCause = { type: 'exit' };

function setupWithRegistry() {
  const tracker = new FakeTracker();
  const scanner = new FakeScanner();
  const registry = new FakeRegistry();
  const start = () => {
    const monitor = new AttentionMonitor({ tracker, scanner, turns: new FakeTurns(), registry });
    const events: AttentionEvent[] = [];
    monitor.onEvent((event) => events.push(event));
    return { monitor, events };
  };
  return { tracker, scanner, registry, start };
}

describe('AttentionMonitor session-end events', () => {
  // plan-session_notifications/REQ-21, REQ-23: a signal the client did not send ends the session with no error
  it('gives one session_end event with error false, at once, when a foreign signal ends a known hosted session', () => {
    const { tracker, registry, start } = setupWithRegistry();
    tracker.seed(hosted('h1', 'working'));
    const { events } = start();

    registry.end('h1', { signal: 9 });
    tracker.set(hosted('h1', 'ended'), EXIT);

    expect(events).toEqual([
      { id: expect.stringMatching(UUID), sessionId: 'h1', kind: 'session_end', folder: '/projects/ai-client', label: 'Fix the login form', error: false },
    ]);
  });

  // plan-session_notifications/REQ-21, REQ-23
  it('gives one session_end event with error true when the process exits with a code other than 0', () => {
    const { tracker, registry, start } = setupWithRegistry();
    tracker.seed(hosted('h1', 'working'));
    const { events } = start();

    registry.end('h1', { exitCode: 1 });
    tracker.set(hosted('h1', 'ended'), EXIT);

    expect(events).toEqual([expect.objectContaining({ sessionId: 'h1', kind: 'session_end', error: true })]);
  });

  // plan-session_notifications/REQ-22: exit code 0 is the user's exit command
  it('gives no event when the process exits with code 0', () => {
    const { tracker, registry, start } = setupWithRegistry();
    tracker.seed(hosted('h1', 'working'));
    const { events } = start();

    registry.end('h1', { exitCode: 0 });
    tracker.set(hosted('h1', 'ended'), EXIT);

    expect(events).toEqual([]);
  });

  // plan-session_notifications/REQ-22: Terminate, quit of the desktop app, server shutdown
  it('gives no event when stop() was called, whatever the exit code or the signal', () => {
    const { tracker, registry, start } = setupWithRegistry();
    const ends: Partial<ProcessEnd>[] = [{ signal: 15 }, { signal: 9 }, { exitCode: 1 }, { exitCode: 0 }];
    ends.forEach((_, i) => tracker.seed(hosted(`h${i}`, 'working')));
    const { events } = start();

    ends.forEach((end, i) => {
      registry.end(`h${i}`, { ...end, stopRequested: true });
      tracker.set(hosted(`h${i}`, 'ended'), EXIT);
    });

    expect(events).toEqual([]);
  });

  // plan-session_notifications/REQ-21: from any state the session was in
  it('gives the event whatever the known state before the end', () => {
    const { tracker, registry, start } = setupWithRegistry();
    tracker.seed(hosted('h1', 'working'));
    tracker.seed(hosted('h2', 'idle'));
    tracker.seed(hosted('h3', 'needs_input'));
    const { events } = start();

    for (const id of ['h1', 'h2', 'h3']) {
      registry.end(id, { signal: 9 });
      tracker.set(hosted(id, 'ended'), EXIT);
    }

    expect(events.map((event) => [event.sessionId, event.kind])).toEqual([
      ['h1', 'session_end'],
      ['h2', 'session_end'],
      ['h3', 'session_end'],
    ]);
  });

  // plan-session_notifications/REQ-7: folder and label at the time of the state change
  it('takes the folder and the label of the session as it ends', () => {
    const { tracker, registry, start } = setupWithRegistry();
    tracker.seed(hosted('h1', 'working'));
    const { events } = start();

    registry.end('h1', { exitCode: 2 });
    tracker.set(hosted('h1', 'ended', { folder: '/projects/billing', label: 'A later label' }), EXIT);

    expect(events).toEqual([expect.objectContaining({ folder: '/projects/billing', label: 'A later label' })]);
  });

  // plan-session_notifications/REQ-5: first sight is not a transition
  it('gives no event for a hosted session first seen as it ends', () => {
    const { tracker, registry, start } = setupWithRegistry();
    const { events } = start();

    registry.end('h1', { signal: 9 });
    tracker.set(hosted('h1', 'ended'), EXIT);

    expect(events).toEqual([]);
  });

  // AttentionMonitor: only a change caused by the process exit is checked
  it('gives no event for a change to ended with another cause', () => {
    const { tracker, registry, start } = setupWithRegistry();
    tracker.seed(hosted('h1', 'working'));
    const { events } = start();

    registry.end('h1', { signal: 9 });
    tracker.set(hosted('h1', 'ended'), { type: 'hook', hookEventName: 'SessionEnd' });

    expect(events).toEqual([]);
  });

  // AttentionMonitor: no registry, no session-end event
  it('gives no event when the monitor has no registry', () => {
    const { tracker, scanner, turns } = setup();
    tracker.seed(hosted('h1', 'working'));
    const monitor = new AttentionMonitor({ tracker, scanner, turns });
    const events: AttentionEvent[] = [];
    monitor.onEvent((event) => events.push(event));

    tracker.set(hosted('h1', 'ended'), EXIT);

    expect(events).toEqual([]);
  });

  // AttentionMonitor: the registry has no Session with that id
  it('gives no event when the registry has no session with that id', () => {
    const { tracker, registry, start } = setupWithRegistry();
    tracker.seed(hosted('h1', 'working'));
    const { events } = start();

    registry.end('other', { signal: 9 });
    tracker.set(hosted('h1', 'ended'), EXIT);

    expect(events).toEqual([]);
  });

  // AttentionMonitor: external sessions never give a session-end event
  it('gives no event when an external session disappears', () => {
    const { scanner, registry, start } = setupWithRegistry();
    scanner.seed(external('e1', 'working'));
    const { events } = start();

    registry.end('e1', { signal: 9 });
    scanner.remove('e1');

    expect(events).toEqual([]);
  });

  // AttentionMonitor: list listeners run before the event listeners
  it('calls the list listeners before the event listeners when a session in needs_input ends', () => {
    const { tracker, scanner, registry } = setupWithRegistry();
    tracker.seed(hosted('h1', 'needs_input'));
    const monitor = new AttentionMonitor({ tracker, scanner, turns: new FakeTurns(), registry });
    const calls: string[] = [];
    monitor.onEvent((event) => calls.push(event.kind));
    monitor.onNeedsInputChange((sessions) => calls.push(`list of ${sessions.length}`));

    registry.end('h1', { exitCode: 1 });
    tracker.set(hosted('h1', 'ended'), EXIT);

    expect(calls).toEqual(['list of 0', 'session_end']);
  });
});
