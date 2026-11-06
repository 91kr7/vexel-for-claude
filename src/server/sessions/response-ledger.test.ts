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

const priced = (key: string, model: string, input: number, output: number, sidechain = false): ModelResponse => ({
  key,
  model,
  input,
  output,
  cacheWrite: 0,
  cacheRead: 0,
  sidechain,
});

describe('ResponseLedger, estimated cost', () => {
  // plan-session_usage/REQ-33: no record → no cost, never $0
  it('gives no cost before the first response', () => {
    expect(new ResponseLedger().cost()).toBeUndefined();
  });

  // plan-session_usage/REQ-24, REQ-25: the sum of the cost of every response at the prices of its own model, sidechain included
  it('sums the costs of the responses at the prices of their models', () => {
    const ledger = new ResponseLedger();
    ledger.add(priced('msg_1', 'claude-opus-5-5', 1_000, 2_000));
    ledger.add(priced('msg_2', 'claude-sonnet-5-5', 10_000, 1_000, true));
    const cost = ledger.cost();
    expect(cost).toEqual({ usd: expect.any(Number), incomplete: false });
    expect(cost!.usd).toBeCloseTo((1_000 * 4 + 2_000 * 20 + 10_000 * 2 + 1_000 * 10) / 1_000_000, 12);
  });

  // plan-session_usage/REQ-30, REQ-31: an unknown price marks the cost incomplete; its tokens still count
  it('marks the cost incomplete and keeps the known sum when a model has no price', () => {
    const ledger = new ResponseLedger();
    ledger.add(priced('msg_1', 'claude-opus-5-5', 1_000, 2_000));
    ledger.add(priced('msg_2', 'claude-unknown-9', 50_000, 3_000));
    expect(ledger.cost()).toEqual({ usd: expect.closeTo(0.044, 12), incomplete: true });
    expect(ledger.totals()).toEqual({ input: 51_000, output: 5_000, cacheWrite: 0, cacheRead: 0 });
  });

  // plan-session_usage/REQ-30: only unknown prices → no usd, incomplete
  it('gives no usd when no response has a known price', () => {
    const ledger = new ResponseLedger();
    ledger.add(priced('msg_1', 'claude-unknown-9', 1_000, 2_000));
    ledger.add(priced('msg_2', '', 1_000, 2_000));
    const cost = ledger.cost();
    expect(cost).toEqual({ incomplete: true });
    expect(cost).not.toHaveProperty('usd');
    expect(ledger.totals()).toEqual({ input: 2_000, output: 4_000, cacheWrite: 0, cacheRead: 0 });
  });

  // ResponseLedger spec: a known model with no tokens costs 0, and the cost is complete
  it('gives usd 0 for a known model with no tokens', () => {
    const ledger = new ResponseLedger();
    ledger.add(priced('msg_1', 'claude-opus-5-5', 0, 0));
    expect(ledger.cost()).toEqual({ usd: 0, incomplete: false });
  });

  // plan-session_usage/REQ-24, ResponseLedger spec: a replaced record replaces its cost; a line with less output changes nothing
  it('replaces the cost of a replaced record', () => {
    const ledger = new ResponseLedger();
    ledger.add(priced('msg_1', 'claude-opus-5-5', 1_000, 10));
    ledger.add(priced('msg_2', 'claude-opus-5-5', 1_000, 0));
    ledger.add(priced('msg_1', 'claude-opus-5-5', 1_000, 2_000));
    expect(ledger.cost()!.usd).toBeCloseTo((2_000 * 4 + 2_000 * 20) / 1_000_000, 12);
    ledger.add(priced('msg_1', 'claude-opus-5-5', 1_000, 5));
    expect(ledger.cost()!.usd).toBeCloseTo((2_000 * 4 + 2_000 * 20) / 1_000_000, 12);
    ledger.add(priced('msg_1', 'claude-opus-5-5', 1_000, 2_000, true));
    expect(ledger.cost()!.usd).toBeCloseTo((2_000 * 4 + 2_000 * 20) / 1_000_000, 12);
  });

  // ResponseLedger spec: a replaced record takes its unknown cost out, so the mark goes away
  it('clears the incomplete mark when the only unknown record is replaced by a priced one', () => {
    const ledger = new ResponseLedger();
    ledger.add(priced('msg_1', 'claude-opus-5-5', 1_000, 2_000));
    ledger.add(priced('msg_2', 'claude-unknown-9', 1_000, 10));
    expect(ledger.cost()!.incomplete).toBe(true);
    ledger.add(priced('msg_2', 'claude-opus-5-5', 1_000, 2_000));
    expect(ledger.cost()).toEqual({ usd: expect.closeTo(0.088, 12), incomplete: false });
  });

  // ResponseLedger spec: a replaced record takes its known cost out, so an all-unknown ledger has no usd
  it('drops the usd when the only priced record is replaced by an unknown one', () => {
    const ledger = new ResponseLedger();
    ledger.add(priced('msg_1', 'claude-opus-5-5', 1_000, 10));
    ledger.add(priced('msg_1', 'claude-unknown-9', 1_000, 20));
    expect(ledger.cost()).toEqual({ incomplete: true });
  });

  // ResponseLedger spec: cost() gives a copy
  it('gives a copy of the cost', () => {
    const ledger = new ResponseLedger();
    ledger.add(priced('msg_1', 'claude-opus-5-5', 1_000, 2_000));
    const cost = ledger.cost()!;
    cost.usd = 99;
    cost.incomplete = true;
    expect(ledger.cost()).toEqual({ usd: expect.closeTo(0.044, 12), incomplete: false });
  });
});
