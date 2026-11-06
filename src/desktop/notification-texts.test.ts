import { describe, expect, it } from 'vitest';
import { needsInputBody, notificationTexts, notificationTitle, sessionEndBody, turnEndBody } from './notification-texts.js';

describe('notificationTitle', () => {
  // plan-session_notifications/REQ-7: folder name and label, as the list shows them
  it('is "<folder name> · <label>"', () => {
    expect(notificationTitle('/home/dev/projects/ai-client', 'Fix the login form')).toBe('ai-client · Fix the login form');
  });

  it('takes the last non-empty segment of the folder', () => {
    expect(notificationTitle('/home/dev/projects/ai-client/', 'Label')).toBe('ai-client · Label');
    expect(notificationTitle('ai-client', 'Label')).toBe('ai-client · Label');
  });

  it('uses the folder itself when it has no non-empty segment', () => {
    expect(notificationTitle('/', 'Label')).toBe('/ · Label');
  });
});

describe('needsInputBody', () => {
  // plan-session_notifications/REQ-8: wording of the needs-input card
  it('is "Permission for <tool>" when the waiting tool is known', () => {
    expect(needsInputBody('Bash')).toBe('Permission for Bash');
  });

  // plan-session_notifications/REQ-9
  it('is "Needs your input" when the waiting tool is unknown or empty', () => {
    expect(needsInputBody()).toBe('Needs your input');
    expect(needsInputBody('')).toBe('Needs your input');
  });

  it('is plain text: markup characters are not escaped', () => {
    expect(needsInputBody('mcp__<b>&co')).toBe('Permission for mcp__<b>&co');
  });
});

describe('turnEndBody', () => {
  // plan-session_notifications/REQ-16
  it('is the excerpt when there is one', () => {
    expect(turnEndBody('Done. The tests pass.')).toBe('Done. The tests pass.');
  });

  // plan-session_notifications/REQ-17
  it('is "Claude finished" when the excerpt is missing or empty', () => {
    expect(turnEndBody()).toBe('Claude finished');
    expect(turnEndBody('')).toBe('Claude finished');
  });
});

describe('sessionEndBody', () => {
  // plan-session_notifications/REQ-23
  it('is "Session ended with an error" when the session ended with an error', () => {
    expect(sessionEndBody(true)).toBe('Session ended with an error');
  });

  // plan-session_notifications/REQ-23
  it('is "Session ended" otherwise', () => {
    expect(sessionEndBody(false)).toBe('Session ended');
    expect(sessionEndBody()).toBe('Session ended');
  });
});

describe('notificationTexts', () => {
  // plan-session_notifications/REQ-7, REQ-8, REQ-9
  it('gives the title and the needs-input body of an event', () => {
    const base = { id: 'ev-1', sessionId: 's1', kind: 'needs_input' as const, folder: '/projects/billing', label: 'Review the invoices' };
    expect(notificationTexts({ ...base, waitingTool: 'Edit' })).toEqual({ title: 'billing · Review the invoices', body: 'Permission for Edit' });
    expect(notificationTexts(base)).toEqual({ title: 'billing · Review the invoices', body: 'Needs your input' });
  });

  // plan-session_notifications/REQ-7, REQ-16, REQ-17
  it('gives the title and the turn-end body of an event', () => {
    const base = { id: 'ev-2', sessionId: 's1', kind: 'turn_end' as const, folder: '/projects/billing', label: 'Review the invoices' };
    expect(notificationTexts({ ...base, excerpt: 'Done. The tests pass.' })).toEqual({ title: 'billing · Review the invoices', body: 'Done. The tests pass.' });
    expect(notificationTexts(base)).toEqual({ title: 'billing · Review the invoices', body: 'Claude finished' });
  });

  // plan-session_notifications/REQ-7, REQ-23
  it('gives the title and the session-end body of an event', () => {
    const base = { id: 'ev-3', sessionId: 's1', kind: 'session_end' as const, folder: '/projects/billing', label: 'Review the invoices' };
    expect(notificationTexts({ ...base, error: true })).toEqual({ title: 'billing · Review the invoices', body: 'Session ended with an error' });
    expect(notificationTexts({ ...base, error: false })).toEqual({ title: 'billing · Review the invoices', body: 'Session ended' });
  });
});
