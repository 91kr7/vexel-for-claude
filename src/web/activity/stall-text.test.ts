import { describe, expect, it } from 'vitest';
import { stallText } from './stall-text';

const MINUTE = 60_000;

describe('stallText', () => {
  // plan-session_activity/REQ-16, REQ-18: the time of silence, then the running tool with its argument
  it('gives the time of silence and the running tool with its argument', () => {
    expect(stallText(8 * MINUTE, { name: 'Bash', argument: 'mvn test', others: 0 })).toBe('No activity for 8 min · mvn test running');
  });

  // plan-session_activity/REQ-19, REQ-20: the subagent type before the tool, and "+N" for the other tools
  it('puts the subagent type before the tool and the count of the other tools after it', () => {
    expect(stallText(8 * MINUTE, { subagentType: 'sdd-tester', name: 'Bash', argument: 'mvn test', others: 2 })).toBe(
      'No activity for 8 min · sdd-tester: mvn test running +2',
    );
  });

  // plan-session_activity/REQ-18: no running tool → Claude's response
  it("waits for Claude's response", () => {
    expect(stallText(8 * MINUTE, 'response')).toBe("No activity for 8 min · waiting for Claude's response");
  });

  // plan-session_activity/REQ-26: no argument → the tool name; no type → no prefix
  it('shows the tool name when there is no argument, and no prefix when there is no type', () => {
    expect(stallText(6 * MINUTE, { name: 'WebSearch', others: 0 })).toBe('No activity for 6 min · WebSearch running');
    expect(stallText(6 * MINUTE, { subagentType: '', name: 'WebSearch', argument: '', others: 0 })).toBe('No activity for 6 min · WebSearch running');
  });

  // stall-text spec: no argument and no name → only "running"
  it('shows only "running" when the tool has neither argument nor name', () => {
    expect(stallText(6 * MINUTE, { name: '', others: 0 })).toBe('No activity for 6 min · running');
    expect(stallText(6 * MINUTE, { subagentType: 'Explore', name: '', others: 1 })).toBe('No activity for 6 min · Explore: running +1');
  });

  // plan-session_activity/REQ-26: no waitingFor → the time of silence alone
  it('gives the time of silence alone when waitingFor is missing', () => {
    expect(stallText(8 * MINUTE)).toBe('No activity for 8 min');
  });

  // plan-session_activity/REQ-15, REQ-21: the time uses the short form and follows the silence
  it.each([
    [5 * MINUTE, 'No activity for 5 min'],
    [9 * MINUTE + 59_999, 'No activity for 9 min'],
    [65 * MINUTE, 'No activity for 1 h 05 min'],
  ])('writes %i ms of silence as "%s"', (silenceMs, text) => {
    expect(stallText(silenceMs, 'response')).toBe(`${text} · waiting for Claude's response`);
  });
});
