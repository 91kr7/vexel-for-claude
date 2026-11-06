import { describe, expect, it } from 'vitest';
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
const show = (shown: AttentionEvent): NotificationCommand => ({ type: 'show', event: shown });

/** Rules where each given session has a needs-input notification. */
function withNotifications(...sessionIds: string[]): NotificationRules {
  const rules = new NotificationRules();
  for (const sessionId of sessionIds) rules.receiveEvent(event(sessionId));
  return rules;
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
