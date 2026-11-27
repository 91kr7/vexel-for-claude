// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, run, unmountAll } from '../settings/settings-test-support';
import { SubagentCard } from './SubagentCard';
import type { TurnSubagent } from './turn-store';

const NOW = Date.parse('2026-11-26T10:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;

const full: TurnSubagent = {
  id: 'agent-a',
  type: 'sdd-developer',
  description: 'Implement batch turn-panel',
  model: 'claude-opus-5-5',
  state: 'running',
  startedAt: ago(42_000),
  latestText: 'Overwriting the whole CommonServiceImpl class',
  currentTool: { name: 'Bash', argument: 'npm test', others: 2 },
  groups: [],
};

const cardOf = (subagent: TurnSubagent) => mount(<SubagentCard subagent={subagent} />).querySelector('article')!;
const durationOf = (card: Element) => card.querySelector('time')?.textContent ?? null;
const titled = (card: Element, title: string) => card.querySelector(`[title="${CSS.escape(title)}"]`);

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
  unmountAll();
  vi.useRealTimers();
});

describe('SubagentCard, fields', () => {
  // plan-session_activity/REQ-32, REQ-35, REQ-36: an article named after the type, with type, description, model, latest text and current tool
  it('shows type, description, model, latest text and current tool, each with its full text as tooltip', () => {
    const card = cardOf(full);
    expect(card.getAttribute('aria-label')).toBe('Subagent: sdd-developer');
    expect(titled(card, 'sdd-developer')?.textContent).toBe('sdd-developer');
    expect(titled(card, 'Implement batch turn-panel')?.textContent).toBe('Implement batch turn-panel');
    expect(titled(card, 'claude-opus-5-5')?.textContent).toBe('claude-opus-5-5');
    expect(titled(card, 'Overwriting the whole CommonServiceImpl class')?.textContent).toBe('Overwriting the whole CommonServiceImpl class');
    const tool = [...card.querySelectorAll('[title]')].find((element) => element.getAttribute('title')?.startsWith('Bash: npm test'));
    expect(tool?.textContent).toMatch(/^Bash: npm test\s*\+2$/);
  });

  // subagent-card spec: the fields show top to bottom in this order
  it('shows the fields in the order type, state, description, model, duration, latest text, current tool', () => {
    const text = cardOf(full).textContent!;
    const positions = ['sdd-developer', 'Running', 'Implement batch', 'claude-opus-5-5', '42 s', 'Overwriting', 'Bash: npm test'].map((part) => text.indexOf(part));
    expect(positions.every((position) => position >= 0), text).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  // plan-session_activity/REQ-36: a tool with no argument and no other call shows its name only
  it('shows only the tool name when it has no argument and no other call runs', () => {
    const card = cardOf({ ...full, currentTool: { name: 'TodoWrite', others: 0 } });
    expect(titled(card, 'TodoWrite')?.textContent?.trim()).toBe('TodoWrite');
    expect(card.textContent).not.toContain('+0');
  });

  // plan-session_activity/REQ-44: missing fields leave their place empty and the card keeps the others
  it('shows the other fields when type, description, model, latest text and current tool are missing', () => {
    const card = cardOf({ id: 'agent-b', state: 'running', startedAt: ago(5 * MIN), groups: [] });
    expect(card.getAttribute('aria-label')).toBe('Subagent');
    expect(card.textContent).toContain('Running');
    expect(durationOf(card)).toBe('5 min');
    expect(card.textContent).not.toContain('undefined');
  });
});

describe('SubagentCard, state and duration', () => {
  // plan-session_activity/REQ-33: the state pill
  it.each([
    ['running', 'Running'],
    ['finished', 'Finished'],
    ['stopped', 'Stopped'],
  ] as const)('shows the state %s as "%s"', (state, label) => {
    const card = cardOf({ ...full, state, endedAt: ago(0) });
    const pill = [...card.querySelectorAll('*')].find((element) => element.children.length === 0 && element.textContent === label);
    expect(pill, card.textContent!).toBeDefined();
  });

  // plan-session_activity/REQ-34, REQ-9: the duration of a running subagent counts up every second
  it('counts the duration of a running subagent up every second', () => {
    const card = cardOf(full);
    expect(durationOf(card)).toBe('42 s');
    run(() => vi.advanceTimersByTime(1_000));
    expect(durationOf(card)).toBe('43 s');
  });

  // plan-session_activity/REQ-34, REQ-15: a finished or stopped subagent shows its full run time, fixed
  it.each(['finished', 'stopped'] as const)('shows the fixed run time of a %s subagent', (state) => {
    const card = cardOf({ ...full, state, startedAt: ago(70 * MIN), endedAt: ago(3 * MIN) });
    expect(card.textContent).toContain('1 h 07 min');
    run(() => vi.advanceTimersByTime(5 * MIN));
    expect(card.textContent).toContain('1 h 07 min');
  });

  // plan-session_activity/REQ-44: no start, or an ended subagent with no valid end → no duration
  it('shows no duration without a start, or for an ended subagent without a valid end', () => {
    const noStart = cardOf({ ...full, startedAt: undefined });
    expect(noStart.textContent).not.toMatch(/\d+ (s|min)\b/);
    const noEnd = cardOf({ ...full, state: 'finished', startedAt: ago(5 * MIN), endedAt: undefined });
    expect(noEnd.textContent).not.toMatch(/\d+ (s|min)\b/);
    const badEnd = cardOf({ ...full, state: 'stopped', startedAt: ago(5 * MIN), endedAt: 'not a date' });
    expect(badEnd.textContent).not.toMatch(/\d+ (s|min)\b/);
  });
});
