import { describe, expect, it } from 'vitest';
import { formatMessageTime } from './ConversationView';

// Local times, so the expectations hold in any time zone.
const local = (year: number, month: number, day: number, hours: number, minutes: number) => new Date(year, month - 1, day, hours, minutes, 30);
const now = local(2026, 11, 5, 21, 10);

describe('formatMessageTime', () => {
  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-36: the time of a message of today
  it('gives HH:MM for a time on the same calendar day as now', () => {
    expect(formatMessageTime(local(2026, 11, 5, 20, 45).toISOString(), now)).toBe('20:45');
    expect(formatMessageTime(local(2026, 11, 5, 9, 7).toISOString(), now)).toBe('09:07');
    expect(formatMessageTime(local(2026, 11, 5, 0, 0).toISOString(), now)).toBe('00:00');
  });

  // ConversationView "Message time": any other day
  it('gives DD/MM/YYYY HH:MM for a time on any other day', () => {
    expect(formatMessageTime(local(2026, 11, 4, 23, 59).toISOString(), now)).toBe('04/11/2026 23:59');
    expect(formatMessageTime(local(2026, 1, 9, 8, 5).toISOString(), now)).toBe('09/01/2026 08:05');
    expect(formatMessageTime(local(2025, 11, 5, 20, 45).toISOString(), now)).toBe('05/11/2025 20:45');
    expect(formatMessageTime(local(2026, 10, 5, 20, 45).toISOString(), now)).toBe('05/10/2026 20:45');
    expect(formatMessageTime(local(2026, 11, 6, 0, 1).toISOString(), now)).toBe('06/11/2026 00:01');
  });

  it('compares calendar days, not 24-hour spans', () => {
    const justAfterMidnight = local(2026, 11, 5, 0, 30);
    expect(formatMessageTime(local(2026, 11, 4, 23, 50).toISOString(), justAfterMidnight)).toBe('04/11/2026 23:50');
    expect(formatMessageTime(local(2026, 11, 5, 0, 10).toISOString(), justAfterMidnight)).toBe('00:10');
  });

  it('gives "" for a value that is not a valid date', () => {
    for (const iso of ['', 'ieri', '2026-13-45T99:99:00Z']) expect(formatMessageTime(iso, now)).toBe('');
  });
});
