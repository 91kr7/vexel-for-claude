import { describe, expect, it } from 'vitest';
import { itemsOf } from '../external/transcript-reader.js';
import { runningToolOf } from './running-tool.js';

const cardSummaryOf = (name: string, input: unknown): string | undefined => {
  const [item] = itemsOf({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name, input }] } });
  return item?.kind === 'tool_call' ? item.summary : undefined;
};

describe('runningToolOf', () => {
  // runningToolOf contract: no open call, no tool
  it('gives undefined when no call is open', () => {
    expect(runningToolOf([])).toBeUndefined();
  });

  // plan-session_list_improvements/REQ-15: tool name and main argument
  it('gives the tool name and its main argument', () => {
    expect(runningToolOf([{ name: 'Bash', input: { command: 'npm test', description: 'Run the tests' } }])).toEqual({ name: 'Bash', argument: 'npm test', others: 0 });
    expect(runningToolOf([{ name: 'Read', input: { file_path: '/home/dev/app/src/main.ts' } }])).toEqual({
      name: 'Read',
      argument: '/home/dev/app/src/main.ts',
      others: 0,
    });
  });

  // plan-session_list_improvements/REQ-15: the argument is the one the tool-call card shows
  it('gives the same argument as the summary of the tool-call card, for a one-line input', () => {
    const inputs: [string, unknown][] = [
      ['Bash', { command: 'npm test' }],
      ['Read', { file_path: '/srv/app/README.md', limit: 20 }],
      ['Grep', { pattern: 'TODO', path: '/srv/app' }],
      ['Glob', { pattern: '**/*.ts' }],
      ['WebFetch', { url: 'https://example.com/docs', prompt: 'Summarize' }],
      ['WebSearch', { query: 'vitest fake timers' }],
      ['Task', { description: 'Review the batch', prompt: 'Read the files and report' }],
      ['Custom', { mode: 3, target: 'staging' }],
    ];
    for (const [name, input] of inputs) {
      expect(runningToolOf([{ name, input }])?.argument, name).toBe(cardSummaryOf(name, input));
    }
  });

  // plan-session_list_improvements/REQ-16: no main argument, tool name only
  it('has no argument when the input has no main argument', () => {
    for (const input of [undefined, null, {}, { limit: 5, all: true }, 'npm test', 42, [1, 2]]) {
      const tool = runningToolOf([{ name: 'TodoWrite', input }]);
      expect(tool, JSON.stringify(input)).toEqual({ name: 'TodoWrite', others: 0 });
      expect(tool && 'argument' in tool, JSON.stringify(input)).toBe(false);
    }
  });

  // plan-session_list_improvements/REQ-18: only the first line of a command, for every line ending
  it('keeps only the first line of a multi-line argument', () => {
    for (const command of ['npm ci\nnpm test\nnpm run build', 'npm ci\r\nnpm test', 'npm ci\rnpm test']) {
      expect(runningToolOf([{ name: 'Bash', input: { command } }])?.argument, JSON.stringify(command)).toBe('npm ci');
    }
  });

  // runningToolOf contract: the first line is trimmed, and absent when blank after the trim
  it('trims the first line and drops it when it is blank', () => {
    expect(runningToolOf([{ name: 'Bash', input: { command: '   npm test   \nexit' } }])?.argument).toBe('npm test');
    expect(runningToolOf([{ name: 'Bash', input: { command: '   \nnpm test' } }])).toEqual({ name: 'Bash', others: 0 });
    expect(runningToolOf([{ name: 'Bash', input: { command: '' } }])).toEqual({ name: 'Bash', others: 0 });
  });

  // plan-session_list_improvements/REQ-17: the server does not cut a long first line, the page does
  it('keeps a long first line whole', () => {
    const long = `echo ${'x'.repeat(300)}`;
    expect(runningToolOf([{ name: 'Bash', input: { command: long } }])?.argument).toBe(long);
  });

  // plan-session_list_improvements/REQ-19: the last call that started, and the count of the others
  it('gives the last call and the number of the other calls', () => {
    const tool = runningToolOf([
      { name: 'Read', input: { file_path: '/a.ts' } },
      { name: 'Grep', input: { pattern: 'x' } },
      { name: 'Bash', input: { command: 'npm test' } },
    ]);
    expect(tool).toEqual({ name: 'Bash', argument: 'npm test', others: 2 });
  });

  // runningToolOf invariant: pure, the calls are not changed
  it('is pure and does not change the calls', () => {
    const calls = [
      { name: 'Read', input: { file_path: '/a.ts' } },
      { name: 'Bash', input: { command: ' npm test\nmore ' } },
    ];
    const copy = structuredClone(calls);
    const first = runningToolOf(calls);
    expect(runningToolOf(calls)).toEqual(first);
    expect(calls).toEqual(copy);
  });
});
