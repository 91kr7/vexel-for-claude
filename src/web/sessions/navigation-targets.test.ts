// Tests of plan-keyboard_shortcuts, batch navigation: sessionToOpen spec.
import { describe, expect, it } from 'vitest';
import type { SessionState, SessionSummary } from './live-session-store';
import { sessionToOpen } from './navigation-targets';

const session = (id: string, state: SessionState, minute: number, external = false): SessionSummary => ({
  id,
  folder: `/projects/${id}`,
  label: id,
  state,
  lastActivity: `2026-11-09T10:${String(minute).padStart(2, '0')}:00.000Z`,
  ...(external ? { external: true as const } : {}),
});

// Shown list, by the session-order groups: ask (needs input), run-new, run-old (running, latest first), ext (external), done (ended).
const SESSIONS: readonly SessionSummary[] = [
  session('done', 'ended', 50),
  session('run-old', 'idle', 10),
  session('ext', 'idle', 40, true),
  session('run-new', 'working', 30),
  session('ask', 'needs_input', 5),
];

const previous = { kind: 'previous' } as const;
const next = { kind: 'next' } as const;
const position = (n: number) => ({ kind: 'position', position: n }) as const;
const needsInput = { kind: 'next-needs-input' } as const;

describe('sessionToOpen, previous and next', () => {
  // plan-keyboard_shortcuts/REQ-4: previous gives the entry above the open one, across groups
  it('previous gives the entry above the open one', () => {
    expect(sessionToOpen(SESSIONS, {}, 'run-new', previous)).toBe('ask');
    expect(sessionToOpen(SESSIONS, {}, 'done', previous)).toBe('ext');
  });

  // plan-keyboard_shortcuts/REQ-4, REQ-43: previous stops at the top of the list
  it('previous gives none on the first entry', () => {
    expect(sessionToOpen(SESSIONS, {}, 'ask', previous)).toBeNull();
  });

  // plan-keyboard_shortcuts/REQ-5: next gives the entry below the open one, across groups
  it('next gives the entry below the open one', () => {
    expect(sessionToOpen(SESSIONS, {}, 'ask', next)).toBe('run-new');
    expect(sessionToOpen(SESSIONS, {}, 'run-old', next)).toBe('ext');
  });

  // plan-keyboard_shortcuts/REQ-5, REQ-43: next stops at the end of the list
  it('next gives none on the last entry', () => {
    expect(sessionToOpen(SESSIONS, {}, 'done', next)).toBeNull();
  });

  // sessionToOpen contract ("Previous and next" assumption): with no open entry, previous gives the last and next the first
  it.each([
    ['no open session', null],
    ['an open session the list does not have', 'gone'],
  ])('with %s, previous gives the last entry and next the first', (_, open) => {
    expect(sessionToOpen(SESSIONS, {}, open, previous)).toBe('done');
    expect(sessionToOpen(SESSIONS, {}, open, next)).toBe('ask');
  });

  // sessionToOpen contract: the list follows the saved order inside each group
  it('follows the saved order of a group', () => {
    const order = { running: ['run-old', 'run-new'] };
    expect(sessionToOpen(SESSIONS, order, 'ask', next)).toBe('run-old');
    expect(sessionToOpen(SESSIONS, order, 'run-old', next)).toBe('run-new');
    expect(sessionToOpen(SESSIONS, order, 'ext', previous)).toBe('run-new');
  });
});

describe('sessionToOpen, position', () => {
  // plan-keyboard_shortcuts/REQ-6: position n is the entry at n in the list as shown, across the groups
  it.each([
    [1, 'ask'],
    [2, 'run-new'],
    [3, 'run-old'],
    [4, 'ext'],
    [5, 'done'],
  ])('position %i gives %s', (n, id) => {
    expect(sessionToOpen(SESSIONS, {}, null, position(n))).toBe(id);
  });

  // plan-keyboard_shortcuts/REQ-6, REQ-43: a position with no entry gives none
  it('gives none past the end of the list', () => {
    expect(sessionToOpen(SESSIONS, {}, 'ask', position(6))).toBeNull();
    expect(sessionToOpen(SESSIONS, {}, 'ask', position(9))).toBeNull();
  });

  // sessionToOpen contract: a position that is not an integer from 1 gives none
  it.each([0, -1, 1.5, Number.NaN])('gives none for position %s', (n) => {
    expect(sessionToOpen(SESSIONS, {}, null, position(n))).toBeNull();
  });

  // sessionToOpen contract: position may give the open session itself
  it('may give the open session', () => {
    expect(sessionToOpen(SESSIONS, {}, 'run-new', position(2))).toBe('run-new');
  });
});

describe('sessionToOpen, next that needs input', () => {
  // Shown list: a1, a2, a3 (needs input), r1 (running), e1 (ended).
  const WAITING: readonly SessionSummary[] = [
    session('a1', 'needs_input', 30),
    session('a2', 'needs_input', 20),
    session('a3', 'needs_input', 10),
    session('r1', 'idle', 40),
    session('e1', 'ended', 50),
  ];

  // plan-keyboard_shortcuts/REQ-7: the first entry that needs input after the open one
  it('gives the next entry that needs input below the open one', () => {
    expect(sessionToOpen(WAITING, {}, 'a2', needsInput)).toBe('a3');
  });

  // plan-keyboard_shortcuts/REQ-8: from the last waiting entry the search wraps to the top, skipping entries that do not wait
  it('wraps from the end of the list to its start', () => {
    expect(sessionToOpen(WAITING, {}, 'a3', needsInput)).toBe('a1');
    expect(sessionToOpen(WAITING, {}, 'r1', needsInput)).toBe('a1');
    expect(sessionToOpen(WAITING, {}, 'e1', needsInput)).toBe('a1');
  });

  // sessionToOpen contract ("Needs input" assumption): with no open entry the search starts at the top
  it.each([
    ['no open session', null],
    ['an open session the list does not have', 'gone'],
  ])('with %s, starts at the top of the list', (_, open) => {
    expect(sessionToOpen(WAITING, {}, open, needsInput)).toBe('a1');
  });

  // sessionToOpen contract: the open entry itself is checked last
  it('gives the open session when it is the only one that needs input', () => {
    const sessions = [session('only', 'needs_input', 10), session('r1', 'idle', 40)];
    expect(sessionToOpen(sessions, {}, 'only', needsInput)).toBe('only');
  });

  // plan-keyboard_shortcuts/REQ-9: no entry needs input gives none
  it('gives none when no session needs input', () => {
    const sessions = [session('r1', 'idle', 40), session('w1', 'working', 30), session('e1', 'ended', 50)];
    expect(sessionToOpen(sessions, {}, 'r1', needsInput)).toBeNull();
    expect(sessionToOpen(sessions, {}, null, needsInput)).toBeNull();
  });
});

describe('sessionToOpen, inputs', () => {
  // sessionToOpen contract: an empty list gives none for every target
  it.each([previous, next, position(1), needsInput])('gives none on an empty list for %o', (target) => {
    expect(sessionToOpen([], {}, null, target)).toBeNull();
    expect(sessionToOpen([], {}, 'gone', target)).toBeNull();
  });

  // sessionToOpen contract: the inputs are not changed
  it('does not change its inputs', () => {
    const sessions = Object.freeze(SESSIONS.map((s) => Object.freeze({ ...s })));
    const order = Object.freeze({ running: Object.freeze(['run-old']) });
    const snapshot = JSON.stringify([sessions, order]);
    for (const target of [previous, next, position(2), needsInput]) sessionToOpen(sessions, order, 'run-new', target);
    expect(JSON.stringify([sessions, order])).toBe(snapshot);
  });
});
