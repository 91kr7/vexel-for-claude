import { describe, expect, it } from 'vitest';
import { shortDuration } from './short-duration';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

describe('shortDuration', () => {
  // plan-session_activity/REQ-15: under one minute → "N s", whole seconds rounded down
  it.each([
    [0, '0 s'],
    [999, '0 s'],
    [1 * SECOND, '1 s'],
    [42 * SECOND + 900, '42 s'],
    [59 * SECOND + 999, '59 s'],
  ])('gives %i ms as "%s"', (ms, text) => {
    expect(shortDuration(ms)).toBe(text);
  });

  // plan-session_activity/REQ-15: under one hour → "N min", whole minutes rounded down
  it.each([
    [MINUTE, '1 min'],
    [2 * MINUTE + 59 * SECOND, '2 min'],
    [3 * MINUTE, '3 min'],
    [59 * MINUTE + 59 * SECOND + 999, '59 min'],
  ])('gives %i ms as "%s"', (ms, text) => {
    expect(shortDuration(ms)).toBe(text);
  });

  // plan-session_activity/REQ-15: from one hour → "H h MM min", minutes on two digits
  it.each([
    [HOUR, '1 h 00 min'],
    [65 * MINUTE, '1 h 05 min'],
    [HOUR + 10 * MINUTE + 59 * SECOND, '1 h 10 min'],
    [16 * HOUR, '16 h 00 min'],
    [100 * HOUR + 59 * MINUTE + 59 * SECOND, '100 h 59 min'],
  ])('gives %i ms as "%s"', (ms, text) => {
    expect(shortDuration(ms)).toBe(text);
  });

  // short-duration spec: a negative duration or one that is not a finite number counts as 0
  it.each([-1, -5 * MINUTE, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('gives %s ms as "0 s"', (ms) => {
    expect(shortDuration(ms)).toBe('0 s');
  });
});
