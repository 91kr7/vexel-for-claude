import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { formatRelativeTime, RelativeTime } from './RelativeTime';

const now = new Date(2026, 10, 5, 15, 30, 0);
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
const SECOND = 1000;
const MINUTE = 60 * SECOND;

describe('formatRelativeTime', () => {
  // relative-time spec: an invalid time gives empty text
  it('gives empty text for an invalid time', () => {
    expect(formatRelativeTime('not a time', now)).toBe('');
    expect(formatRelativeTime('', now)).toBe('');
  });

  // batch decision "Times", relative-time spec: "Just now" under one minute, future included
  it.each([0, 1, 59])('gives "Just now" %i s ago', (seconds) => {
    expect(formatRelativeTime(ago(seconds * SECOND), now)).toBe('Just now');
  });

  // relative-time spec: a time in the future gives "Just now"
  it('gives "Just now" for a time in the future', () => {
    expect(formatRelativeTime(new Date(now.getTime() + 10 * MINUTE).toISOString(), now)).toBe('Just now');
  });

  // batch decision "Times", relative-time spec: "Nm ago" under one hour, N = whole minutes
  it.each([
    [60 * SECOND, '1m ago'],
    [2 * MINUTE + 59 * SECOND, '2m ago'],
    [59 * MINUTE + 59 * SECOND, '59m ago'],
  ])('gives the whole minutes for %i ms ago', (ms, text) => {
    expect(formatRelativeTime(ago(ms), now)).toBe(text);
  });

  // batch decision "Times", relative-time spec: same local day after one hour gives HH:MM, two digits each
  it('gives the local HH:MM on the same day after one hour', () => {
    expect(formatRelativeTime(new Date(2026, 10, 5, 14, 30, 0).toISOString(), now)).toBe('14:30');
    expect(formatRelativeTime(new Date(2026, 10, 5, 0, 5, 9).toISOString(), now)).toBe('00:05');
  });

  // batch decision "Times", relative-time spec: an earlier day gives DD/MM/YYYY local date
  it('gives the local date DD/MM/YYYY on an earlier day', () => {
    expect(formatRelativeTime(new Date(2026, 10, 4, 23, 59, 0).toISOString(), now)).toBe('04/11/2026');
    expect(formatRelativeTime(new Date(2025, 0, 7, 9, 0, 0).toISOString(), now)).toBe('07/01/2025');
  });

  // relative-time spec: the "Nm ago" rule comes before the day rule, across midnight too
  it('gives minutes rather than the date for a time 10 minutes before midnight', () => {
    const justAfterMidnight = new Date(2026, 10, 6, 0, 5, 0);
    expect(formatRelativeTime(new Date(2026, 10, 5, 23, 55, 0).toISOString(), justAfterMidnight)).toBe('10m ago');
  });
});

describe('RelativeTime', () => {
  // relative-time spec: a <time> element with dateTime = iso and the formatted text
  it('renders a time element with dateTime and the class given', () => {
    const iso = new Date(Date.now() - 5 * MINUTE).toISOString();
    const html = renderToStaticMarkup(<RelativeTime iso={iso} className="body-s" />);
    expect(html).toMatch(new RegExp(`^<time\\b(?=[^>]*\\sdateTime="${iso}")(?=[^>]*\\sclass="body-s")[^>]*>5m ago</time>$`, 'i'));
  });
});
