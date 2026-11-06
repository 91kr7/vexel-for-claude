import { describe, expect, it } from 'vitest';
import { type PricedResponse, costOf } from './response-cost.js';

const MTOK = 1_000_000;
const priced = (model: string, counts: Partial<Omit<PricedResponse, 'model'>> = {}): PricedResponse => ({
  model,
  input: 0,
  output: 0,
  cacheWrite: 0,
  cacheRead: 0,
  ...counts,
});

describe('costOf', () => {
  // response-cost spec example
  it('prices 1,000 input and 2,000 output tokens of claude-opus-5-5 at $0.044', () => {
    expect(costOf(priced('claude-opus-5-5', { input: 1_000, output: 2_000 }))).toBeCloseTo(0.044, 12);
  });

  // plan-session_usage/REQ-25, REQ-26: each of the five categories at its own price (claude-opus-5-5: 4, 5, 8, 0.20, 20)
  it.each<[string, Partial<PricedResponse>, number]>([
    ['input', { input: MTOK }, 4],
    ['5-minute cache write', { cacheWrite: MTOK, cacheWrite5m: MTOK, cacheWrite1h: 0 }, 5],
    ['1-hour cache write', { cacheWrite: MTOK, cacheWrite5m: 0, cacheWrite1h: MTOK }, 8],
    ['cache read', { cacheRead: MTOK }, 0.2],
    ['output', { output: MTOK }, 20],
  ])('prices one million %s tokens of claude-opus-5-5', (_, counts, usd) => {
    expect(costOf(priced('claude-opus-5-5', counts))).toBeCloseTo(usd, 9);
  });

  // plan-session_usage/REQ-26: a response with both cache write durations and every category
  it('sums the five categories of one response', () => {
    const response = priced('claude-sonnet-5-5', { input: 2_000, output: 3_000, cacheWrite: 10_000, cacheWrite5m: 4_000, cacheWrite1h: 6_000, cacheRead: 50_000 });
    const expected = (2_000 * 2 + 3_000 * 10 + 4_000 * 2.5 + 6_000 * 4 + 50_000 * 0.1) / MTOK;
    expect(costOf(response)).toBeCloseTo(expected, 12);
  });

  // plan-session_usage/REQ-27: no recorded duration → every cache write token at the 5-minute price
  it('prices a cache write with no split as a 5-minute cache write', () => {
    expect(costOf(priced('claude-opus-5-5', { cacheWrite: MTOK }))).toBeCloseTo(5, 9);
    expect(costOf(priced('claude-opus-5-5', { cacheWrite: MTOK, cacheWrite1h: 0 }))).toBeCloseTo(5, 9);
    expect(costOf(priced('claude-opus-5-5', { cacheWrite: MTOK, cacheWrite5m: 0 }))).toBeCloseTo(5, 9);
  });

  // plan-session_usage/REQ-28: prompt length = input + cache write + cache read; the tier applies to every count, output included
  it.each<[string, Partial<PricedResponse>, 'first' | 'second']>([
    ['exactly 100,000 input tokens', { input: 100_000, output: 10_000 }, 'first'],
    ['100,001 input tokens', { input: 100_001, output: 10_000 }, 'second'],
    ['100,001 prompt tokens over the three parts', { input: 1, cacheWrite: 40_000, cacheRead: 60_000, output: 10_000 }, 'second'],
    ['100,000 prompt tokens and a large output', { input: 50_000, cacheRead: 50_000, output: 200_000 }, 'first'],
  ])('prices claude-haiku-5-5 with %s at the %s tier', (_, counts, expectedTier) => {
    const prices = expectedTier === 'first' ? { input: 0.1, cacheWrite5m: 0.125, cacheRead: 0.01, output: 0.5 } : { input: 0.5, cacheWrite5m: 0.625, cacheRead: 0.05, output: 2.5 };
    const response = priced('claude-haiku-5-5', counts);
    const expected =
      (response.input * prices.input + response.cacheWrite * prices.cacheWrite5m + response.cacheRead * prices.cacheRead + response.output * prices.output) / MTOK;
    expect(costOf(response)).toBeCloseTo(expected, 12);
  });

  // plan-session_usage/REQ-28: the 1-hour cache write of the second Haiku 5.5 tier
  it('prices the 1-hour cache write of a long claude-haiku-5-5 prompt at the second tier', () => {
    const response = priced('claude-haiku-5-5', { input: 1_000, cacheWrite: 200_000, cacheWrite5m: 0, cacheWrite1h: 200_000 });
    expect(costOf(response)).toBeCloseTo((1_000 * 0.5 + 200_000 * 1) / MTOK, 12);
  });

  // price-list spec: the "[1m]" marker and the date suffix do not change the price, whatever the prompt length
  it('prices an extended-context and a dated model id as the plain id', () => {
    const counts = { input: 300_000, output: 5_000, cacheRead: 100_000 };
    const plain = costOf(priced('claude-sonnet-5-5', counts));
    expect(plain).toBeCloseTo((300_000 * 2 + 5_000 * 10 + 100_000 * 0.1) / MTOK, 12);
    expect(costOf(priced('claude-sonnet-5-5[1m]', counts))).toBe(plain);
    expect(costOf(priced('claude-sonnet-5-5-20261001', counts))).toBe(plain);
  });

  // plan-session_usage/REQ-30: a model with no known price → unknown cost
  it.each(['', 'claude-unknown-9', '<synthetic>'])('gives no cost for the model %j', (model) => {
    expect(costOf(priced(model, { input: 1_000, output: 1_000 }))).toBeUndefined();
  });

  // response-cost spec: a known model with all counts at 0 costs 0, not unknown
  it('gives 0 for a known model with no tokens', () => {
    expect(costOf(priced('claude-opus-5-5'))).toBe(0);
  });

  it('gives the same result for the same response', () => {
    const response = priced('claude-haiku-5-5', { input: 120_000, output: 900 });
    expect(costOf(response)).toBe(costOf({ ...response }));
  });
});
