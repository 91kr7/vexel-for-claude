import { describe, expect, it } from 'vitest';
import { isValidResetTime, lastReadText, remainingText, resetDateText } from './reset-time-format';

const NOW = Date.UTC(2026, 10, 9, 12, 0, 0);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

describe('remainingText', () => {
  // plan-usage_limits/REQ-9: the time remaining, cut down to the unit
  it.each([
    [30_000, '<1m'],
    [MINUTE - 1, '<1m'],
    [MINUTE, '1m'],
    [45 * MINUTE + 59_000, '45m'],
    [HOUR - 1, '59m'],
    [HOUR, '1h 0m'],
    [2 * HOUR + 15 * MINUTE, '2h 15m'],
    [DAY - 1, '23h 59m'],
    [DAY, '1d 0h'],
    [3 * DAY + 4 * HOUR + 30 * MINUTE, '3d 4h'],
  ])('shows %s ms as "%s"', (offset, expected) => {
    expect(remainingText(at(offset), NOW)).toBe(expected);
  });

  // spec: in the past, or not a date -> "<1m"
  it('gives "<1m" for a reset in the past', () => {
    expect(remainingText(at(-3 * HOUR), NOW)).toBe('<1m');
  });

  it('gives "<1m" for the exact moment', () => {
    expect(remainingText(at(0), NOW)).toBe('<1m');
  });

  it.each(['', 'soon', 'not a date'])('gives "<1m" for the text "%s"', (text) => {
    expect(remainingText(text, NOW)).toBe('<1m');
  });
});

describe('resetDateText', () => {
  // plan-usage_limits/REQ-9: local weekday, day, month and 24-hour time, in English
  it('shows weekday, day, month and 24-hour time', () => {
    expect(resetDateText(new Date(2026, 10, 14, 18, 30).toISOString())).toBe('Sat 14 Nov, 18:30');
  });

  it('pads the time and keeps the day without padding', () => {
    expect(resetDateText(new Date(2026, 0, 5, 9, 5).toISOString())).toBe('Mon 5 Jan, 09:05');
  });

  it('shows midnight as 00:00', () => {
    expect(resetDateText(new Date(2026, 11, 31, 0, 0).toISOString())).toBe('Thu 31 Dec, 00:00');
  });

  it('reads an ISO text with an offset as the same instant', () => {
    const text = '2026-11-14T18:30:00+01:00';
    const local = new Date(text);
    const pad = (n: number) => String(n).padStart(2, '0');
    expect(resetDateText(text)).toMatch(new RegExp(`, ${pad(local.getHours())}:${pad(local.getMinutes())}$`));
  });
});

describe('lastReadText', () => {
  // plan-usage_limits/REQ-14: local 24-hour time HH:MM
  it.each([
    [new Date(2026, 10, 9, 7, 3), '07:03'],
    [new Date(2026, 10, 9, 23, 59), '23:59'],
    [new Date(2026, 10, 9, 0, 0), '00:00'],
  ])('shows %s as %s', (date, expected) => {
    expect(lastReadText(date.getTime())).toBe(expected);
  });
});

describe('isValidResetTime', () => {
  it('is true for a date and false for text that is not', () => {
    expect(isValidResetTime('2026-11-14T18:30:00+01:00')).toBe(true);
    expect(isValidResetTime('2026-11-14T17:30:00Z')).toBe(true);
    expect(isValidResetTime('')).toBe(false);
    expect(isValidResetTime('soon')).toBe(false);
  });
});
