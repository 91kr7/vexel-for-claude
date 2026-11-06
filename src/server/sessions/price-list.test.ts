import { describe, expect, it } from 'vitest';
import { PRICES_READ_ON, pricingOf } from './price-list.js';

// Prices of the price-list spec table, USD per million tokens: input, 5m cache write, 1h cache write, cache read, output.
const tier = (fromPromptTokens: number, input: number, cacheWrite5m: number, cacheWrite1h: number, cacheRead: number, output: number) => ({
  fromPromptTokens,
  input,
  cacheWrite5m,
  cacheWrite1h,
  cacheRead,
  output,
});

describe('pricingOf', () => {
  // plan-session_usage/REQ-25, REQ-26: each known model has its five list prices
  it.each([
    ['claude-fable-5-1', tier(0, 10, 12.5, 20, 0.25, 50)],
    ['claude-mythos-5-1', tier(0, 10, 12.5, 20, 0.25, 50)],
    ['claude-fable-5', tier(0, 10, 12.5, 20, 1, 50)],
    ['claude-mythos-5', tier(0, 10, 12.5, 20, 1, 50)],
    ['claude-opus-5-5', tier(0, 4, 5, 8, 0.2, 20)],
    ['claude-opus-5', tier(0, 5, 6.25, 10, 0.5, 25)],
    ['claude-opus-4-8', tier(0, 5, 6.25, 10, 0.5, 25)],
    ['claude-opus-4-7', tier(0, 5, 6.25, 10, 0.5, 25)],
    ['claude-opus-4-6', tier(0, 5, 6.25, 10, 0.5, 25)],
    ['claude-opus-4-5', tier(0, 5, 6.25, 10, 0.5, 25)],
    ['claude-opus-4-1', tier(0, 15, 18.75, 30, 1.5, 75)],
    ['claude-opus-4', tier(0, 15, 18.75, 30, 1.5, 75)],
    ['claude-sonnet-5-5', tier(0, 2, 2.5, 4, 0.1, 10)],
    ['claude-sonnet-5', tier(0, 2, 2.5, 4, 0.2, 10)],
    ['claude-sonnet-4-6', tier(0, 3, 3.75, 6, 0.3, 15)],
    ['claude-sonnet-4-5', tier(0, 3, 3.75, 6, 0.3, 15)],
    ['claude-sonnet-4', tier(0, 3, 3.75, 6, 0.3, 15)],
    ['claude-haiku-4-5', tier(0, 1, 1.25, 2, 0.1, 5)],
  ])('gives %s one tier with its list prices', (model, prices) => {
    expect(pricingOf(model)).toEqual([prices]);
  });

  // plan-session_usage/REQ-28: Haiku 5.5 has a higher tier for prompts above 100,000 tokens
  it('gives claude-haiku-5-5 two tiers, the second from 100,001 prompt tokens', () => {
    expect(pricingOf('claude-haiku-5-5')).toEqual([tier(0, 0.1, 0.125, 0.2, 0.01, 0.5), tier(100_001, 0.5, 0.625, 1, 0.05, 2.5)]);
  });

  // price-list spec: the date suffix, the "[1m]" marker and the letter case do not change the entry
  it.each([
    ['claude-opus-4-5-20251101', 'claude-opus-4-5'],
    ['claude-haiku-5-5-20261001', 'claude-haiku-5-5'],
    ['claude-sonnet-5-5[1m]', 'claude-sonnet-5-5'],
    ['claude-opus-4-6-20260201[1m]', 'claude-opus-4-6'],
    ['Claude-Opus-5-5', 'claude-opus-5-5'],
  ])('prices %s as %s', (model, entry) => {
    expect(pricingOf(model)).toBeDefined();
    expect(pricingOf(model)).toEqual(pricingOf(entry));
  });

  // price-list spec: the match is on the whole id, never on a prefix
  it('tells claude-opus-5 and claude-opus-5-5 apart', () => {
    expect(pricingOf('claude-opus-5')).not.toEqual(pricingOf('claude-opus-5-5'));
  });

  // plan-session_usage/REQ-30: a model missing from the list has no price
  it.each(['', '<synthetic>', 'claude-opus-5-9', 'claude-opus', 'claude-3-opus-20240229', 'claude-mythos-preview', 'gpt-5', 'claude-opus-5-5-preview'])(
    'gives no price to %j',
    (model) => {
      expect(pricingOf(model)).toBeUndefined();
    },
  );

  it('gives the same result for the same id', () => {
    expect(pricingOf('claude-haiku-5-5')).toEqual(pricingOf('claude-haiku-5-5'));
  });

  // price-list spec: the date the prices were read
  it('records the date the prices were read', () => {
    expect(PRICES_READ_ON).toBe('2026-11-06');
  });
});
