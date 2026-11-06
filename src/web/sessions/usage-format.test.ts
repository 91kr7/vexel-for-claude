import { describe, expect, it } from 'vitest';
import { costText, INCOMPLETE_COST_TEXT, percentOf, shortTokens, usageLevelOf } from './usage-format';

describe('shortTokens', () => {
  // plan-session_usage/REQ-11: below 1,000 the plain number
  it.each([
    [0, '0'],
    [950, '950'],
    [999, '999'],
  ])('gives %d as %s', (count, text) => {
    expect(shortTokens(count)).toBe(text);
  });

  // plan-session_usage/REQ-11: thousands with one decimal and "k", a trailing ".0" dropped
  it.each([
    [1_000, '1k'],
    [45_200, '45.2k'],
    [45_249, '45.2k'],
    [200_000, '200k'],
    [999_949, '999.9k'],
  ])('gives %d as %s', (count, text) => {
    expect(shortTokens(count)).toBe(text);
  });

  // plan-session_usage/REQ-11: millions with one decimal and "M"; 999,950 rounds to "1M", not "1000k"
  it.each([
    [999_950, '1M'],
    [1_000_000, '1M'],
    [1_300_000, '1.3M'],
    [12_340_000, '12.3M'],
  ])('gives %d as %s', (count, text) => {
    expect(shortTokens(count)).toBe(text);
  });
});

describe('percentOf', () => {
  // plan-session_usage/REQ-2, requirements "Percentage": rounded to the nearest whole number
  it('gives the rounded percentage of used over window', () => {
    expect(percentOf({ used: 45_200, window: 200_000 })).toBe(23);
    expect(percentOf({ used: 300_000, window: 1_000_000 })).toBe(30);
    expect(percentOf({ used: 149_000, window: 200_000 })).toBe(75);
    expect(percentOf({ used: 183_000, window: 200_000 })).toBe(92);
    expect(percentOf({ used: 900, window: 200_000 })).toBe(0);
  });
});

describe('usageLevelOf', () => {
  // plan-session_usage/REQ-8, requirements "Stand out": warning from 70 %, error from 90 %
  it.each([
    [0, 'normal'],
    [69, 'normal'],
    [70, 'warning'],
    [89, 'warning'],
    [90, 'error'],
    [100, 'error'],
  ])('gives %d%% the level %s', (percent, level) => {
    expect(usageLevelOf(percent)).toBe(level);
  });
});

describe('costText', () => {
  // plan-session_usage/REQ-32: two decimals with "$"
  it.each([
    [0.01, '$0.01'],
    [0.85, '$0.85'],
    [1.27, '$1.27'],
    [1.266, '$1.27'],
    [12, '$12.00'],
    [1234.5, '$1234.50'],
  ])('gives %d the text %s', (usd, text) => {
    expect(costText(usd)).toBe(text);
  });

  // plan-session_usage/REQ-32: below one cent, 0 included
  it.each([0, 0.0001, 0.0099])('gives %d the text "<$0.01"', (usd) => {
    expect(costText(usd)).toBe('<$0.01');
  });

  // plan-session_usage/REQ-30: no known price at all → "—"
  it('gives "—" when there is no usd', () => {
    expect(costText(undefined)).toBe('—');
  });

  // usage-format spec: the text of the "incomplete" mark
  it('names the incomplete mark', () => {
    expect(INCOMPLETE_COST_TEXT).toBe('Incomplete: the price of a model is unknown');
  });
});
