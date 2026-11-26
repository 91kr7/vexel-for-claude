import { describe, expect, it } from 'vitest';
import type { SubagentMeta } from '../external/transcript-reader.js';
import type { OpenCall } from './turn-model.js';
import { waitingForOf } from './waiting-for.js';

const T1 = '2026-11-26T10:01:00.000Z';
const T2 = '2026-11-26T10:02:00.000Z';
const T3 = '2026-11-26T10:03:00.000Z';

const call = (id: string, name: string, input: unknown, order: number, extra: { subagentType?: string; at?: string } = {}): OpenCall => ({
  id,
  name,
  ...(input !== undefined && { input }),
  order,
  ...extra,
});
const running = (meta: SubagentMeta) => ({ meta });

describe('waitingForOf', () => {
  // plan-session_activity/REQ-18: no running tool → Claude's response
  it('waits for the response when no call is open', () => {
    expect(waitingForOf([], [])).toBe('response');
  });

  // plan-session_activity/REQ-18: the running tool with its main argument
  it('names the running tool with its main argument', () => {
    expect(waitingForOf([call('t1', 'Bash', { command: 'mvn test', description: 'Run the tests' }, 1, { at: T1 })], [])).toEqual({ name: 'Bash', argument: 'mvn test', others: 0 });
  });

  // plan-session_activity/REQ-20: the first call started, and the count of the others
  it('names the first call and counts the others', () => {
    const calls = [
      call('t1', 'Bash', { command: 'npm run build' }, 1, { at: T1 }),
      call('t2', 'Grep', { pattern: 'TODO' }, 2, { subagentType: 'Explore', at: T2 }),
      call('t3', 'Read', { file_path: '/src/a.ts' }, 3, { subagentType: 'sdd-tester', at: T3 }),
    ];
    expect(waitingForOf(calls, [])).toEqual({ name: 'Bash', argument: 'npm run build', others: 2 });
  });

  // plan-session_activity/REQ-19: a subagent tool carries the subagent type
  it('carries the subagent type of the first call', () => {
    expect(waitingForOf([call('s1', 'Bash', { command: 'mvn test' }, 1, { subagentType: 'sdd-tester', at: T1 })], [])).toEqual({
      subagentType: 'sdd-tester',
      name: 'Bash',
      argument: 'mvn test',
      others: 0,
    });
  });

  // plan-session_activity/REQ-18, REQ-20 and the gatekeeper decision "The call that starts a subagent": that call is not a running tool
  it('leaves out the calls that started a running subagent, also from the count', () => {
    const calls = [
      call('toolu_a', 'Agent', { description: 'Run the tests', prompt: 'Run mvn test' }, 1, { at: T1 }),
      call('toolu_b', 'Agent', { description: 'Explore', prompt: 'Look around' }, 2, { at: T1 }),
      call('s1', 'Bash', { command: 'mvn test' }, 3, { subagentType: 'sdd-tester', at: T2 }),
      call('s2', 'Glob', { pattern: '**/*.ts' }, 4, { subagentType: 'Explore', at: T3 }),
    ];
    const subagents = [running({ agentType: 'sdd-tester', toolUseId: 'toolu_a' }), running({ agentType: 'Explore', toolUseId: 'toolu_b' })];
    expect(waitingForOf(calls, subagents)).toEqual({ subagentType: 'sdd-tester', name: 'Bash', argument: 'mvn test', others: 1 });
  });

  // plan-session_activity/REQ-18: only calls that started a running subagent → Claude's response
  it('waits for the response when the only open calls started running subagents', () => {
    const calls = [call('toolu_a', 'Agent', { description: 'Run the tests' }, 1, { at: T1 })];
    expect(waitingForOf(calls, [running({ agentType: 'sdd-tester', toolUseId: 'toolu_a' })])).toBe('response');
  });

  // waiting-for spec: a subagent with no toolUseId in its metadata leaves out no call
  it('leaves out no call for a subagent with no toolUseId', () => {
    const calls = [call('toolu_a', 'Agent', { description: 'Run the tests' }, 1, { at: T1 })];
    expect(waitingForOf(calls, [running({ agentType: 'sdd-tester' })])).toEqual({ name: 'Agent', argument: 'Run the tests', others: 0 });
  });

  // waiting-for spec: the argument is the first line of the main argument, trimmed
  it('takes the first line of the main argument, trimmed', () => {
    expect(waitingForOf([call('t1', 'Bash', { command: '  cd server && mvn test  \nnpm run build' }, 1)], [])).toEqual({ name: 'Bash', argument: 'cd server && mvn test', others: 0 });
    expect(waitingForOf([call('t1', 'Bash', { command: 'make\r\nmake install' }, 1)], [])).toEqual({ name: 'Bash', argument: 'make', others: 0 });
  });

  // plan-session_activity/REQ-26: no input, no main argument or an empty first line → the tool name alone
  it('has no argument when the tool has no input, no main argument, or an empty first line', () => {
    const noInput = waitingForOf([call('w1', 'WebSearch', undefined, 1)], []);
    expect(noInput).toEqual({ name: 'WebSearch', others: 0 });
    expect(noInput).not.toHaveProperty('argument');
    expect(waitingForOf([call('t1', 'TodoWrite', { todos: [] }, 1)], [])).not.toHaveProperty('argument');
    expect(waitingForOf([call('t1', 'Bash', { command: '   \nls' }, 1)], [])).not.toHaveProperty('argument');
  });

  // plan-session_activity/REQ-26: an empty subagent type is left out
  it('leaves out an empty subagent type', () => {
    const result = waitingForOf([call('s1', 'Bash', { command: 'ls' }, 1, { subagentType: '' })], []);
    expect(result).toEqual({ name: 'Bash', argument: 'ls', others: 0 });
    expect(result).not.toHaveProperty('subagentType');
  });

  // waiting-for spec: pure, the input is not changed
  it('changes neither the calls nor the subagents', () => {
    const calls = [call('toolu_a', 'Agent', { description: 'Run' }, 1, { at: T1 }), call('s1', 'Bash', { command: 'ls' }, 2, { subagentType: 'Plan', at: T2 })];
    const subagents = [running({ agentType: 'Plan', toolUseId: 'toolu_a' })];
    const before = structuredClone({ calls, subagents });
    const first = waitingForOf(Object.freeze(calls), Object.freeze(subagents));
    expect(waitingForOf(calls, subagents)).toEqual(first);
    expect({ calls, subagents }).toEqual(before);
  });
});
