import { describe, expect, it } from 'vitest';
import { isInterruptMarker, startsTurn } from './turn-rule.js';

const userLine = (content: unknown, extra: Record<string, unknown> = {}) => ({
  type: 'user',
  isSidechain: false,
  timestamp: '2026-11-26T10:00:00.000Z',
  message: { role: 'user', content },
  ...extra,
});

describe('isInterruptMarker', () => {
  // turn-rule spec: true when the text starts with "[Request interrupted by user"
  it.each(['[Request interrupted by user]', '[Request interrupted by user for tool use]'])('is true for %s', (text) => {
    expect(isInterruptMarker(text)).toBe(true);
  });

  it.each(['Please stop', 'I said: [Request interrupted by user]', ''])('is false for "%s"', (text) => {
    expect(isInterruptMarker(text)).toBe(false);
  });
});

describe('startsTurn', () => {
  // plan-session_activity/REQ-10: a message that the user types starts a turn
  it('is true for a message the user types', () => {
    expect(startsTurn(userLine('Fix the login bug', { origin: { kind: 'human' } }))).toBe(true);
  });

  // turn-rule spec: lines of older versions have no origin, and still start a turn
  it('is true for a user message with no origin', () => {
    expect(startsTurn(userLine('Fix the login bug'))).toBe(true);
  });

  // turn-rule spec: a line with no user message is no turn start
  it.each([
    ['an assistant line', { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] } }],
    ['a meta line', userLine('<system-reminder>x</system-reminder>', { isMeta: true })],
    ['a sidechain line', userLine('Explore the repository', { isSidechain: true })],
    ['a tool result', userLine([{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }])],
  ])('is false for %s', (_what, entry) => {
    expect(startsTurn(entry)).toBe(false);
  });

  // plan-session_activity/REQ-10: an interrupt marker starts no turn
  it.each(['[Request interrupted by user]', '[Request interrupted by user for tool use]'])('is false for the interrupt marker %s', (text) => {
    expect(startsTurn(userLine(text))).toBe(false);
    expect(startsTurn(userLine([{ type: 'text', text }]))).toBe(false);
  });

  // plan-session_activity/REQ-10: a message added by Claude Code (origin kind other than "human") starts no turn
  it('is false for a message whose origin kind is not "human"', () => {
    expect(startsTurn(userLine('Background work finished', { origin: { kind: 'task-notification' }, promptSource: 'system' }))).toBe(false);
    expect(startsTurn(userLine('Something else', { origin: { kind: 'scheduled' } }))).toBe(false);
  });

  // turn-rule spec: the summary written after a compaction starts no turn
  it('is false for a compaction summary', () => {
    expect(startsTurn(userLine('This session is being continued from a previous conversation.', { isCompactSummary: true }))).toBe(false);
  });

  // plan-session_activity/REQ-10: a background task notification starts no turn, even with no origin
  it('is false for a text that starts with a task-notification tag', () => {
    const text = '<task-notification>\n<task-id>a1b2</task-id>\n<status>completed</status>\n</task-notification>';
    expect(startsTurn(userLine(text))).toBe(false);
  });
});
