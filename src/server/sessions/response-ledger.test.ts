import { describe, expect, it } from 'vitest';
import type { ModelResponse } from './model-response.js';
import { ResponseLedger } from './response-ledger.js';

const response = (key: string, input: number, output: number, cacheWrite = 0, cacheRead = 0, sidechain = false): ModelResponse => ({
  key,
  model: 'claude-haiku-5-5',
  input,
  output,
  cacheWrite,
  cacheRead,
  sidechain,
});

describe('ResponseLedger', () => {
  // plan-session_usage/REQ-18: an empty ledger gives no totals, never zeros
  it('gives no totals before the first response', () => {
    expect(new ResponseLedger().totals()).toBeUndefined();
  });

  // plan-session_usage/REQ-14: the sums over every response, main conversation and subagents alike
  it('sums the four counts of every response, main and sidechain', () => {
    const ledger = new ResponseLedger();
    ledger.add(response('msg_1', 10, 100, 1_000, 10_000));
    ledger.add(response('msg_2', 20, 200, 2_000, 20_000, true));
    ledger.add(response('msg_3', 3, 30, 300, 3_000));
    expect(ledger.totals()).toEqual({ input: 33, output: 330, cacheWrite: 3_300, cacheRead: 33_000 });
  });

  // plan-session_usage/REQ-15: a response written on several lines counts once, with its final output
  it('counts a repeated key once, with the line that has more output', () => {
    const ledger = new ResponseLedger();
    ledger.add(response('msg_1', 5, 1, 100, 1_000));
    ledger.add(response('msg_1', 5, 2, 100, 1_000));
    ledger.add(response('msg_1', 5, 480, 100, 1_000));
    expect(ledger.totals()).toEqual({ input: 5, output: 480, cacheWrite: 100, cacheRead: 1_000 });
  });

  // ResponseLedger spec: new output < recorded output → no change
  it('keeps the record when a later line of the key has less output', () => {
    const ledger = new ResponseLedger();
    ledger.add(response('msg_1', 5, 480, 100, 1_000));
    ledger.add(response('msg_1', 999, 3, 999, 999));
    expect(ledger.totals()).toEqual({ input: 5, output: 480, cacheWrite: 100, cacheRead: 1_000 });
  });

  // ResponseLedger spec: new output = recorded output → the later line wins
  it('takes the later line when the output is the same', () => {
    const ledger = new ResponseLedger();
    ledger.add(response('msg_1', 5, 50, 100, 1_000));
    ledger.add(response('msg_1', 7, 50, 200, 2_000));
    expect(ledger.totals()).toEqual({ input: 7, output: 50, cacheWrite: 200, cacheRead: 2_000 });
  });

  // plan-session_usage/REQ-15, REQ-21: a replaced record swaps its counts in the sums, next to other records
  it('replaces only the counts of the replaced record in the sums', () => {
    const ledger = new ResponseLedger();
    ledger.add(response('msg_a', 1, 10, 100, 1_000));
    ledger.add(response('msg_b', 2, 1, 200, 2_000, true));
    ledger.add(response('msg_c', 3, 30, 300, 3_000));
    expect(ledger.totals()).toEqual({ input: 6, output: 41, cacheWrite: 600, cacheRead: 6_000 });
    ledger.add(response('msg_b', 4, 90, 400, 4_000, true));
    expect(ledger.totals()).toEqual({ input: 8, output: 130, cacheWrite: 800, cacheRead: 8_000 });
    ledger.add(response('msg_a', 1, 10, 100, 1_000));
    expect(ledger.totals()).toEqual({ input: 8, output: 130, cacheWrite: 800, cacheRead: 8_000 });
  });

  // plan-session_usage/REQ-15: the same response in two files (main and subagent) counts once
  it('counts a key seen as main and as sidechain once', () => {
    const ledger = new ResponseLedger();
    ledger.add(response('msg_1', 5, 60, 100, 1_000));
    ledger.add(response('msg_1', 5, 60, 100, 1_000, true));
    expect(ledger.totals()).toEqual({ input: 5, output: 60, cacheWrite: 100, cacheRead: 1_000 });
  });

  // ResponseLedger spec: totals() gives a copy
  it('gives a copy of the totals', () => {
    const ledger = new ResponseLedger();
    ledger.add(response('msg_1', 5, 60, 100, 1_000));
    const totals = ledger.totals()!;
    totals.input = 1_000_000;
    totals.output = 1_000_000;
    expect(ledger.totals()).toEqual({ input: 5, output: 60, cacheWrite: 100, cacheRead: 1_000 });
  });
});
