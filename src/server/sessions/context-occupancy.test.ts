import { describe, expect, it } from 'vitest';
import { contextAfter } from './context-occupancy.js';

type Entry = Record<string, unknown>;

let nextKey = 0;
const response = (input: number, cacheWrite: number, cacheRead: number, options: { model?: string; output?: number; sidechain?: boolean } = {}): Entry => {
  nextKey += 1;
  return {
    type: 'assistant',
    uuid: `line-${nextKey}`,
    isSidechain: options.sidechain ?? false,
    message: {
      id: `msg_${nextKey}`,
      model: options.model ?? 'claude-haiku-5-5',
      usage: { input_tokens: input, output_tokens: options.output ?? 500, cache_creation_input_tokens: cacheWrite, cache_read_input_tokens: cacheRead },
    },
  };
};
const userText = (text: string): Entry => ({ type: 'user', isSidechain: false, message: { role: 'user', content: text } });
const compaction: Entry = { type: 'system', subtype: 'compact_boundary' };

describe('contextAfter', () => {
  // plan-session_usage/REQ-9: no response of the main conversation, no occupancy
  it('gives no occupancy for no lines or lines with no response', () => {
    expect(contextAfter(undefined, [])).toBeUndefined();
    expect(contextAfter(undefined, [userText('hello'), { type: 'system', subtype: 'other' }])).toBeUndefined();
  });

  // plan-session_usage/REQ-3: used = input + cache write + cache read of the last main response, no output
  it('uses input, cache write and cache read of the last response, without its output tokens', () => {
    const lines = [userText('a'), response(1, 1, 1), userText('b'), response(200, 15_000, 30_000, { output: 9_999 })];
    expect(contextAfter(undefined, lines)).toEqual({ used: 45_200, window: 200_000 });
  });

  // plan-session_usage/REQ-4: the window is the one of the model of the last response
  it('takes the window from the model of the last response', () => {
    const lines = [response(100_000, 0, 0, { model: 'claude-opus-5-5' }), response(150_000, 0, 0, { model: 'claude-haiku-5-5[1m]' })];
    expect(contextAfter(undefined, lines)).toEqual({ used: 150_000, window: 1_000_000 });
    expect(contextAfter(undefined, [lines[1]!, response(10_000, 0, 0)])).toEqual({ used: 10_000, window: 200_000 });
  });

  // plan-session_usage/REQ-5: above 200,000 used tokens the window is 1,000,000
  it('uses a 1,000,000 window above 200,000 used tokens', () => {
    expect(contextAfter(undefined, [response(100_000, 100_000, 100_000)])).toEqual({ used: 300_000, window: 1_000_000 });
  });

  // plan-session_usage/REQ-6: a subagent response changes nothing
  it('ignores subagent responses', () => {
    const lines = [response(80_000, 0, 0), response(5_000, 0, 0, { sidechain: true })];
    expect(contextAfter(undefined, lines)).toEqual({ used: 80_000, window: 200_000 });
    expect(contextAfter(undefined, [response(5_000, 0, 0, { sidechain: true })])).toBeUndefined();
  });

  // plan-session_usage/REQ-7: a compaction clears the occupancy until the next main response
  it('clears the occupancy at a compaction, and the next main response sets it again', () => {
    expect(contextAfter(undefined, [response(80_000, 0, 0), compaction])).toBeUndefined();
    expect(contextAfter(undefined, [response(80_000, 0, 0), compaction, response(1_000, 0, 0, { sidechain: true })])).toBeUndefined();
    expect(contextAfter(undefined, [response(80_000, 0, 0), compaction, response(12_000, 0, 0)])).toEqual({ used: 12_000, window: 200_000 });
    expect(contextAfter({ used: 80_000, window: 200_000 }, [compaction])).toBeUndefined();
  });

  // contextAfter spec: lines with no response keep the previous value
  it('keeps the previous occupancy when the lines give no response', () => {
    const previous = { used: 80_000, window: 200_000 };
    expect(contextAfter(previous, [userText('x'), response(1, 0, 0, { model: '<synthetic>' })])).toEqual(previous);
  });

  // contextAfter spec: splitting the lines in two calls gives the same result
  it('gives the same result in one call or in two', () => {
    const lines = [response(10_000, 0, 0), compaction, response(5_000, 0, 0, { sidechain: true }), userText('y'), response(20_000, 1_000, 2_000), compaction, response(3_000, 0, 0)];
    for (let cut = 0; cut <= lines.length; cut += 1) {
      const whole = contextAfter({ used: 7, window: 200_000 }, lines);
      expect(contextAfter(contextAfter({ used: 7, window: 200_000 }, lines.slice(0, cut)), lines.slice(cut)), `cut at ${cut}`).toEqual(whole);
    }
  });
});
