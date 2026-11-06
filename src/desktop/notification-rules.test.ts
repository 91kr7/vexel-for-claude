import { describe, expect, it, vi } from 'vitest';
import type { AttentionEvent } from './attention-client.js';
import { type NotificationCommand, NotificationRules } from './notification-rules.js';

let nextId = 0;
const event = (sessionId: string, id = `ev-${(nextId += 1)}`): AttentionEvent => ({
  id,
  sessionId,
  kind: 'needs_input',
  folder: `/projects/${sessionId}`,
  label: `Label ${sessionId}`,
});
const listed = (...ids: string[]) => ids.map((sessionId) => ({ sessionId, folder: `/projects/${sessionId}`, label: `Label ${sessionId}` }));
const close = (sessionId: string): NotificationCommand => ({ type: 'close', sessionId });
const show = (shown: AttentionEvent, replaces?: string): NotificationCommand => ({
  type: 'show',
  event: shown,
  ...(replaces ? { replaces } : {}),
});
/** A grouped notification: it belongs to the session of its first (latest) line. */
const group = (kind: AttentionEvent['kind'], events: AttentionEvent[], replaces?: string): NotificationCommand => ({
  type: 'show-group',
  sessionId: events[0]!.sessionId,
  kind,
  events,
  ...(replaces ? { replaces } : {}),
});

/** Rules where each given session has its own needs-input notification: the events are 6 s apart, so none groups. */
function withNotifications(...sessionIds: string[]): NotificationRules {
  let time = 0;
  const rules = new NotificationRules({ now: () => time });
  for (const sessionId of sessionIds) {
    rules.receiveEvent(event(sessionId));
    time += 6_000;
  }
  return rules;
}

/** Rules on a clock the test sets by hand: `at(ms)` moves the clock and returns the rules. */
function clocked(options: { windowFocused?: boolean } = {}) {
  let time = 0;
  const rules = new NotificationRules({ ...options, now: () => time });
  const at = (ms: number): NotificationRules => {
    time = ms;
    return rules;
  };
  return { rules, at };
}

describe('NotificationRules.receiveEvent', () => {
  // plan-session_notifications/REQ-1, REQ-4: the window is not focused by default
  it('shows a new event while the window does not have the focus', () => {
    const rules = new NotificationRules();
    const received = event('a');
    expect(rules.receiveEvent(received)).toEqual([show(received)]);
  });

  // plan-session_notifications/REQ-6
  it('ignores an event id received before', () => {
    const rules = new NotificationRules();
    const received = event('a');
    rules.receiveEvent(received);
    expect(rules.receiveEvent({ ...received })).toEqual([]);
  });

  // plan-session_notifications/REQ-3
  it('shows nothing while the window has the focus', () => {
    const rules = new NotificationRules({ windowFocused: true });
    expect(rules.receiveEvent(event('a'))).toEqual([]);
    const focusedLater = new NotificationRules();
    focusedLater.setWindowFocused(true);
    expect(focusedLater.receiveEvent(event('a'))).toEqual([]);
  });

  // plan-session_notifications/REQ-3, REQ-6: an event ignored while focused counts as received
  it('does not show, after the window loses the focus, an event received while it had it', () => {
    const rules = new NotificationRules({ windowFocused: true });
    const received = event('a');
    rules.receiveEvent(received);
    rules.setWindowFocused(false);
    expect(rules.receiveEvent(received)).toEqual([]);
  });

  it('shows a later event of the same session with a new id', () => {
    const rules = new NotificationRules();
    rules.receiveEvent(event('a'));
    const later = event('a');
    expect(rules.receiveEvent(later)).toEqual([show(later)]);
  });
});

describe('NotificationRules.receiveNeedsInput', () => {
  // plan-session_notifications/REQ-11
  it('closes the notification of each session that left the list, and only those', () => {
    const rules = withNotifications('a', 'b', 'c');
    const commands = rules.receiveNeedsInput(listed('b'));
    expect(commands).toHaveLength(2);
    expect(commands).toEqual(expect.arrayContaining([close('a'), close('c')]));
  });

  it('closes nothing for sessions with no notification', () => {
    const rules = withNotifications('a');
    expect(rules.receiveNeedsInput(listed('a'))).toEqual([]);
    expect(new NotificationRules().receiveNeedsInput([])).toEqual([]);
  });

  it('closes a notification once: after the close the session has none', () => {
    const rules = withNotifications('a');
    expect(rules.receiveNeedsInput([])).toEqual([close('a')]);
    expect(rules.receiveNeedsInput([])).toEqual([]);
  });

  // plan-session_notifications/REQ-11: a session that is not in the list when its event arrives keeps it until a list without it
  it('closes a notification shown after a list, at the next list without its session', () => {
    const rules = new NotificationRules();
    rules.receiveNeedsInput(listed('a'));
    rules.receiveEvent(event('a'));
    expect(rules.receiveNeedsInput(listed())).toEqual([close('a')]);
  });
});

describe('NotificationRules.setWindowFocused', () => {
  // plan-session_notifications/REQ-12 (gatekeeper decision: the focus on the open session counts as opening it)
  it('closes the notification of the open session when the window gets the focus, and only that one', () => {
    const rules = withNotifications('a', 'b');
    rules.setOpenSession('a');
    expect(rules.setWindowFocused(true)).toEqual([close('a')]);
  });

  it('closes nothing when the open session has no notification', () => {
    const rules = withNotifications('b');
    rules.setOpenSession('a');
    expect(rules.setWindowFocused(true)).toEqual([]);
  });

  it('closes nothing when no session is open', () => {
    const rules = withNotifications('a');
    expect(rules.setWindowFocused(true)).toEqual([]);
  });

  it('closes nothing when the window loses the focus', () => {
    const rules = withNotifications('a');
    rules.setOpenSession('a');
    expect(rules.setWindowFocused(false)).toEqual([]);
  });

  it('after the close, the open session has no notification', () => {
    const rules = withNotifications('a');
    rules.setOpenSession('a');
    rules.setWindowFocused(true);
    rules.setWindowFocused(false);
    expect(rules.setWindowFocused(true)).toEqual([]);
    expect(rules.receiveNeedsInput([])).toEqual([]);
  });
});

describe('NotificationRules.setOpenSession', () => {
  // plan-session_notifications/REQ-12
  it('closes the notification of a session opened while the window has the focus', () => {
    const rules = withNotifications('a', 'b');
    rules.setWindowFocused(true);
    expect(rules.setOpenSession('a')).toEqual([close('a')]);
  });

  it('closes nothing when the window does not have the focus', () => {
    const rules = withNotifications('a');
    expect(rules.setOpenSession('a')).toEqual([]);
  });

  it('closes nothing for a session with no notification, or for no open session', () => {
    const rules = withNotifications('a');
    rules.setWindowFocused(true);
    expect(rules.setOpenSession('b')).toEqual([]);
    expect(rules.setOpenSession(null)).toEqual([]);
  });

  it('closes a notification once', () => {
    const rules = withNotifications('a');
    rules.setWindowFocused(true);
    rules.setOpenSession('a');
    rules.setOpenSession(null);
    expect(rules.setOpenSession('a')).toEqual([]);
  });
});

const turnEnd = (sessionId: string): AttentionEvent => ({ ...event(sessionId), kind: 'turn_end', excerpt: 'Done.' });

describe('NotificationRules with turn-end events', () => {
  // plan-session_notifications/REQ-14
  it('shows a turn-end event while the window does not have the focus', () => {
    const rules = new NotificationRules();
    const received = turnEnd('a');
    expect(rules.receiveEvent(received)).toEqual([show(received)]);
  });

  // plan-session_notifications/REQ-11, REQ-18: only needs-input notifications follow the needs-input list
  it('keeps a turn-end notification when the needs-input list does not have its session', () => {
    const rules = new NotificationRules();
    rules.receiveEvent(turnEnd('a'));
    expect(rules.receiveNeedsInput([])).toEqual([]);
  });

  // plan-session_notifications/REQ-19
  it('a needs-input event replaces the turn-end notification: the session then has one notification, of kind needs_input', () => {
    const rules = new NotificationRules();
    rules.receiveEvent(turnEnd('a'));
    const asking = event('a');
    expect(rules.receiveEvent(asking)).toEqual([show(asking)]);
    expect(rules.receiveNeedsInput(listed('a'))).toEqual([]);
    expect(rules.receiveNeedsInput([])).toEqual([close('a')]);
    expect(rules.receiveNeedsInput([])).toEqual([]);
  });

  // plan-session_notifications/REQ-19
  it('a turn-end event replaces the needs-input notification: a list without the session then closes nothing', () => {
    const rules = new NotificationRules();
    rules.receiveEvent(event('a'));
    rules.receiveNeedsInput(listed('a'));
    const finished = turnEnd('a');
    expect(rules.receiveEvent(finished)).toEqual([show(finished)]);
    expect(rules.receiveNeedsInput([])).toEqual([]);
  });

  // plan-session_notifications/REQ-12
  it('closes the turn-end notification of the open session when the window gets the focus', () => {
    const rules = new NotificationRules();
    rules.receiveEvent(turnEnd('a'));
    rules.setOpenSession('a');
    expect(rules.setWindowFocused(true)).toEqual([close('a')]);
  });
});

const sessionEnd = (sessionId: string): AttentionEvent => ({ ...event(sessionId), kind: 'session_end', error: false });

describe('NotificationRules bursts', () => {
  // plan-session_notifications/REQ-26
  it('shows the first event at once, alone', () => {
    const { at } = clocked();
    const first = event('a');
    expect(at(0).receiveEvent(first)).toEqual([show(first)]);
  });

  // plan-session_notifications/REQ-25, REQ-26
  it('merges an event of another session within 5 s into the notification of the first one, in place', () => {
    const { at } = clocked();
    const first = event('a');
    at(0).receiveEvent(first);
    const second = event('b');
    expect(at(3_000).receiveEvent(second)).toEqual([group('needs_input', [second, first], 'a')]);
  });

  // plan-session_notifications/REQ-25: "within 5 seconds" includes the 5000th millisecond
  it('still merges an event exactly 5000 ms after the first one', () => {
    const { at } = clocked();
    const first = event('a');
    at(10_000).receiveEvent(first);
    const second = event('b');
    expect(at(15_000).receiveEvent(second)).toEqual([group('needs_input', [second, first], 'a')]);
  });

  // plan-session_notifications/REQ-25
  it('gives an event 5001 ms after the first one a notification of its own, and leaves the first one as it is', () => {
    const { at } = clocked();
    at(10_000).receiveEvent(event('a'));
    const late = event('b');
    expect(at(15_001).receiveEvent(late)).toEqual([show(late)]);
  });

  // plan-session_notifications/REQ-25: the 5 s count from the first event of the burst, not from the latest
  it('starts a new burst more than 5 s after the first event, even when the latest event is recent', () => {
    const { at } = clocked();
    at(0).receiveEvent(event('a'));
    at(4_000).receiveEvent(event('b'));
    const third = event('c');
    expect(at(8_000).receiveEvent(third)).toEqual([show(third)]);
  });

  // plan-session_notifications/REQ-25, REQ-26: one line per session, latest event first
  it('adds each new session of the burst as the first line', () => {
    const { at } = clocked();
    const a = event('a');
    const b = event('b');
    const c = event('c');
    at(0).receiveEvent(a);
    expect(at(1_000).receiveEvent(b)).toEqual([group('needs_input', [b, a], 'a')]);
    expect(at(4_000).receiveEvent(c)).toEqual([group('needs_input', [c, b, a], 'b')]);
  });

  it('updates the line of a session already in the burst and moves it first', () => {
    const { at } = clocked();
    const a1 = event('a');
    const b1 = event('b');
    at(0).receiveEvent(a1);
    at(1_000).receiveEvent(b1);
    const a2 = turnEnd('a');
    expect(at(2_000).receiveEvent(a2)).toEqual([group('needs_input', [a2, b1], 'b')]);
  });

  // plan-session_notifications/REQ-6
  it('ignores an event id received before, also inside a burst', () => {
    const { at } = clocked();
    at(0).receiveEvent(event('a'));
    const b = event('b');
    at(1_000).receiveEvent(b);
    expect(at(2_000).receiveEvent({ ...b })).toEqual([]);
  });

  // plan-session_notifications/REQ-3
  it('shows nothing for an event while the window has the focus, and does not add it to the burst', () => {
    const { at } = clocked();
    const a = event('a');
    at(0).receiveEvent(a);
    at(500).setWindowFocused(true);
    expect(at(1_000).receiveEvent(event('b'))).toEqual([]);
    at(1_500).setWindowFocused(false);
    const c = event('c');
    expect(at(2_000).receiveEvent(c)).toEqual([group('needs_input', [c, a], 'a')]);
  });

  // plan-session_notifications/REQ-3: an event ignored while focused starts no burst
  it('does not start a burst with an event received while the window has the focus', () => {
    const { at } = clocked({ windowFocused: true });
    at(0).receiveEvent(event('a'));
    at(500).setWindowFocused(false);
    const b = event('b');
    expect(at(1_000).receiveEvent(b)).toEqual([show(b)]);
  });

  it('ends the burst when the desktop closes its notification by itself', () => {
    const { at } = clocked();
    at(0).receiveEvent(event('a'));
    at(500).notificationClosed('a');
    const b = event('b');
    expect(at(1_000).receiveEvent(b)).toEqual([show(b)]);
  });

  // plan-session_notifications/REQ-11: the burst ends when the rules close its notification
  it('ends the burst when its notification closes because its session no longer needs input', () => {
    const { at } = clocked();
    at(0).receiveEvent(event('a'));
    expect(at(500).receiveNeedsInput([])).toEqual([close('a')]);
    const b = event('b');
    expect(at(1_000).receiveEvent(b)).toEqual([show(b)]);
  });

  // plan-session_notifications/REQ-19: a new event of a session with only its own notification replaces it in place
  it('starts a new burst in place with a new event of a session that has its own notification', () => {
    const { at } = clocked();
    at(0).receiveEvent(event('a'));
    const a2 = event('a');
    expect(at(6_000).receiveEvent(a2)).toEqual([show(a2)]);
    const b = event('b');
    expect(at(7_000).receiveEvent(b)).toEqual([group('needs_input', [b, a2], 'a')]);
  });

  it('merges later events into the new burst, not into the previous one', () => {
    const { at } = clocked();
    at(0).receiveEvent(event('a'));
    const b = event('b');
    expect(at(6_000).receiveEvent(b)).toEqual([show(b)]);
    const c = event('c');
    expect(at(7_000).receiveEvent(c)).toEqual([group('needs_input', [c, b], 'b')]);
  });

  it('keeps the burst running after its notification goes back to one session', () => {
    const { at } = clocked();
    const a = event('a');
    at(0).receiveEvent(a);
    at(1_000).receiveEvent(event('b'));
    expect(at(2_000).receiveNeedsInput(listed('a'))).toEqual([show(a, 'b')]);
    const c = event('c');
    expect(at(3_000).receiveEvent(c)).toEqual([group('needs_input', [c, a], 'a')]);
  });

  it('uses the system clock by default', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-06T10:00:00Z'));
      const rules = new NotificationRules();
      rules.receiveEvent(event('a'));
      vi.setSystemTime(new Date('2026-11-06T10:00:06Z'));
      const b = event('b');
      expect(rules.receiveEvent(b)).toEqual([show(b)]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts no timer', () => {
    vi.useFakeTimers();
    try {
      const { at, rules } = clocked();
      at(0).receiveEvent(event('a'));
      at(1_000).receiveEvent(event('b'));
      rules.receiveNeedsInput(listed('a'));
      rules.setOpenSession('a');
      rules.setWindowFocused(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('NotificationRules grouped notification kind', () => {
  // plan-session_notifications/REQ-27
  it('is needs_input while one of its lines needs input, even when the latest event is a turn end', () => {
    const { at } = clocked();
    const asking = event('a');
    at(0).receiveEvent(asking);
    const finished = turnEnd('b');
    expect(at(1_000).receiveEvent(finished)).toEqual([group('needs_input', [finished, asking], 'a')]);
  });

  it('is the kind of the latest event when no line needs input', () => {
    const { at } = clocked();
    const finished = turnEnd('a');
    at(0).receiveEvent(finished);
    const ended = sessionEnd('b');
    expect(at(1_000).receiveEvent(ended)).toEqual([group('session_end', [ended, finished], 'a')]);
    const finishedLater = turnEnd('c');
    expect(at(2_000).receiveEvent(finishedLater)).toEqual([group('turn_end', [finishedLater, ended, finished], 'b')]);
  });

  // plan-session_notifications/REQ-27: the kind changes in place when the needs-input session leaves
  it('becomes the kind of the latest event when the session that needs input leaves', () => {
    const { at } = clocked();
    const asking = event('a');
    const finishedB = turnEnd('b');
    const finishedC = turnEnd('c');
    at(0).receiveEvent(asking);
    at(1_000).receiveEvent(finishedB);
    expect(at(2_000).receiveEvent(finishedC)).toEqual([group('needs_input', [finishedC, finishedB, asking], 'b')]);
    expect(at(3_000).receiveNeedsInput([])).toEqual([group('turn_end', [finishedC, finishedB])]);
  });
});

describe('NotificationRules grouped notification owner', () => {
  // plan-session_notifications/REQ-28: a click opens the session the notification belongs to
  it('belongs to the session of the latest event', () => {
    const { at } = clocked();
    at(0).receiveEvent(event('a'));
    const [merged] = at(1_000).receiveEvent(event('b'));
    expect(merged).toMatchObject({ type: 'show-group', sessionId: 'b', replaces: 'a' });
    const [updated] = at(2_000).receiveEvent(event('a'));
    expect(updated).toMatchObject({ type: 'show-group', sessionId: 'a', replaces: 'b' });
  });
});

describe('NotificationRules sessions leaving a grouped notification', () => {
  // plan-session_notifications/REQ-29, REQ-11
  it('turns the group into the notification of the one session left when the latest session no longer needs input', () => {
    const { at } = clocked();
    const a = event('a');
    at(0).receiveEvent(a);
    at(1_000).receiveEvent(event('b'));
    expect(at(2_000).receiveNeedsInput(listed('a'))).toEqual([show(a, 'b')]);
  });

  // plan-session_notifications/REQ-29, REQ-11
  it('turns the group into the notification of the one session left when the oldest session no longer needs input', () => {
    const { at } = clocked();
    at(0).receiveEvent(event('a'));
    const b = event('b');
    at(1_000).receiveEvent(b);
    expect(at(2_000).receiveNeedsInput(listed('b'))).toEqual([show(b)]);
  });

  // plan-session_notifications/REQ-29, REQ-11: batch acceptance scenario "A session that is answered leaves the group"
  it('shows only the turn end of the session left, with its own texts, when the session that needed input is answered', () => {
    const { at } = clocked();
    at(0).receiveEvent(event('a'));
    const finished = turnEnd('b');
    at(1_000).receiveEvent(finished);
    expect(at(2_000).receiveNeedsInput([])).toEqual([show(finished)]);
  });

  // plan-session_notifications/REQ-29
  it('keeps a group of the sessions left when one of three leaves', () => {
    const { at } = clocked();
    const a = event('a');
    const c = event('c');
    at(0).receiveEvent(a);
    at(1_000).receiveEvent(event('b'));
    at(2_000).receiveEvent(c);
    expect(at(3_000).receiveNeedsInput(listed('a', 'c'))).toEqual([group('needs_input', [c, a])]);
  });

  // plan-session_notifications/REQ-29, REQ-11: one command for each notification that changed
  it('closes the group, with one command, when no session is left, and leaves the other notifications alone', () => {
    const { at } = clocked();
    at(0).receiveEvent(event('a'));
    at(1_000).receiveEvent(event('b'));
    at(7_000).receiveEvent(event('c'));
    expect(at(8_000).receiveNeedsInput(listed('c'))).toEqual([close('b')]);
    expect(at(9_000).receiveNeedsInput(listed('c'))).toEqual([]);
  });

  // plan-session_notifications/REQ-29, REQ-12
  it('removes the line of a session opened while the window has the focus', () => {
    const { at } = clocked();
    at(0).receiveEvent(event('a'));
    const b = event('b');
    at(1_000).receiveEvent(b);
    expect(at(2_000).setWindowFocused(true)).toEqual([]);
    expect(at(2_500).setOpenSession('a')).toEqual([show(b)]);
  });

  // plan-session_notifications/REQ-29, REQ-12 (gatekeeper decision: the focus on the open session counts as opening it)
  it('removes the line of the open session when the window gets the focus, and keeps the others on screen', () => {
    const { at } = clocked();
    const a = event('a');
    at(0).receiveEvent(a);
    at(1_000).receiveEvent(event('b'));
    expect(at(1_500).setOpenSession('b')).toEqual([]);
    expect(at(2_000).setWindowFocused(true)).toEqual([show(a, 'b')]);
  });

  // plan-session_notifications/REQ-29, REQ-19: a new event after the burst replaces the session's line
  it('moves a session with a new event after the burst out of the group, into a notification of its own', () => {
    const { at } = clocked();
    at(0).receiveEvent(event('a'));
    const b = event('b');
    at(1_000).receiveEvent(b);
    const a2 = event('a');
    expect(at(7_000).receiveEvent(a2)).toEqual([show(b), show(a2)]);
  });

  // plan-session_notifications/REQ-29, REQ-19: the group moves to the session left before the leaving session shows again
  it('gives the group to the session left first when the session it belongs to has a new event after the burst', () => {
    const { at } = clocked();
    const a = event('a');
    at(0).receiveEvent(a);
    at(1_000).receiveEvent(event('b'));
    const b2 = event('b');
    expect(at(7_000).receiveEvent(b2)).toEqual([show(a, 'b'), show(b2)]);
  });

  // plan-session_notifications/REQ-19: a session has at most one notification
  it('closes the own notification of a session that joins the running burst', () => {
    const { at } = clocked();
    at(0).receiveEvent(event('a'));
    const b = event('b');
    at(6_000).receiveEvent(b);
    const a2 = event('a');
    expect(at(7_000).receiveEvent(a2)).toEqual([close('a'), group('needs_input', [a2, b], 'b')]);
  });

  // plan-session_notifications/REQ-29, REQ-19
  it('moves a session out of an older group when it joins the running burst', () => {
    const { at } = clocked();
    at(0).receiveEvent(event('a'));
    const b = event('b');
    at(1_000).receiveEvent(b);
    const c = event('c');
    const d = event('d');
    at(7_000).receiveEvent(c);
    at(8_000).receiveEvent(d);
    const a2 = event('a');
    expect(at(9_000).receiveEvent(a2)).toEqual([show(b), group('needs_input', [a2, d, c], 'd')]);
  });
});

describe('NotificationRules.notificationClosed', () => {
  // plan-session_notifications/REQ-29: a grouped notification closed on the desktop takes all its lines with it
  it('drops the notification and all its lines', () => {
    const { at } = clocked();
    at(0).receiveEvent(event('a'));
    at(1_000).receiveEvent(event('b'));
    at(2_000).notificationClosed('b');
    expect(at(3_000).receiveNeedsInput([])).toEqual([]);
    const c = event('c');
    expect(at(3_500).receiveEvent(c)).toEqual([show(c)]);
  });

  it('does nothing for a session the notification does not belong to', () => {
    const { at } = clocked();
    at(0).receiveEvent(event('a'));
    at(1_000).receiveEvent(event('b'));
    at(2_000).notificationClosed('a');
    expect(at(3_000).receiveNeedsInput([])).toEqual([close('b')]);
  });
});
