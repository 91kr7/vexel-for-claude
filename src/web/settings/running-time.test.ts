import { describe, expect, it } from 'vitest';
import { runningTimeText } from './running-time';

// Unit tests of runningTimeText, plan-app_processes/REQ-13.
const NOW = 1_800_000_000_000;
const startedAgo = (seconds: number) => NOW - seconds * 1000;

describe('runningTimeText', () => {
  it.each([
    [0, '0s'],
    [42, '42s'],
    [59.9, '59s'],
    [60, '1m'],
    [5 * 60 + 30, '5m'],
    [3599, '59m'],
    [3600, '1h 00m'],
    [2 * 3600 + 5 * 60, '2h 05m'],
    [10 * 3600 + 45 * 60 + 59, '10h 45m'],
    [86_399, '23h 59m'],
    [86_400, '1d 0h'],
    [3 * 86_400 + 4 * 3600 + 59 * 60, '3d 4h'],
    [40 * 86_400, '40d 0h'],
  ])('%s seconds elapsed give "%s"', (seconds, text) => {
    expect(runningTimeText(startedAgo(seconds), NOW)).toBe(text);
  });

  it('counts a start time in the future as 0 seconds', () => {
    expect(runningTimeText(NOW + 5000, NOW)).toBe('0s');
  });
});
