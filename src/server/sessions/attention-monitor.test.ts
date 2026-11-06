import { describe, expect, it } from 'vitest';
import type { ExternalSessionChange, ExternalSessionSummary } from '../external/external-session-scanner.js';
import { type AttentionEvent, type AttentionSession, AttentionMonitor } from './attention-monitor.js';
import type { SessionState, SessionSummary } from './session-state-tracker.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class FakeTracker {
  private readonly sessions = new Map<string, SessionSummary>();
  private readonly listeners = new Set<(summary: SessionSummary) => void>();

  list(): SessionSummary[] {
    return [...this.sessions.values()];
  }

  onChange(listener: (summary: SessionSummary) => void): () => void {
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
  set(summary: SessionSummary): void {
    this.sessions.set(summary.id, summary);
    for (const listener of this.listeners) listener(summary);
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

function setup() {
  const tracker = new FakeTracker();
  const scanner = new FakeScanner();
  const start = () => {
    const monitor = new AttentionMonitor({ tracker, scanner });
    const events: AttentionEvent[] = [];
    const lists: AttentionSession[][] = [];
    monitor.onEvent((event) => events.push(event));
    monitor.onNeedsInputChange((sessions) => lists.push(sessions));
    return { monitor, events, lists };
  };
  return { tracker, scanner, start };
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
    const { tracker, scanner } = setup();
    tracker.seed(hosted('h1', 'working'));
    const monitor = new AttentionMonitor({ tracker, scanner });
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
    const { tracker, scanner } = setup();
    tracker.seed(hosted('h1', 'working'));
    const monitor = new AttentionMonitor({ tracker, scanner });
    const calls: string[] = [];
    monitor.onEvent(() => calls.push('event'));
    monitor.onNeedsInputChange(() => calls.push('list'));

    tracker.set(hosted('h1', 'needs_input'));

    expect(calls).toEqual(['list', 'event']);
  });

  it('stops calling a list listener after unsubscribe', () => {
    const { tracker, scanner } = setup();
    tracker.seed(hosted('h1', 'working'));
    const monitor = new AttentionMonitor({ tracker, scanner });
    const lists: AttentionSession[][] = [];
    const unsubscribe = monitor.onNeedsInputChange((sessions) => lists.push(sessions));

    unsubscribe();
    tracker.set(hosted('h1', 'needs_input'));

    expect(lists).toEqual([]);
  });
});
