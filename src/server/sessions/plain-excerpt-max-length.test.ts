import { describe, expect, it } from 'vitest';
import { plainExcerpt } from './plain-excerpt.js';

describe('plainExcerpt with a maximum length', () => {
  // plan-session_activity/REQ-6: a text of exactly maxLength characters stays whole
  it('keeps a text of exactly maxLength characters', () => {
    expect(plainExcerpt('x'.repeat(400), 400)).toBe('x'.repeat(400));
  });

  // plain-excerpt spec: more than maxLength → the first maxLength - 1 characters and "…"
  it('cuts a longer text to maxLength - 1 characters and "…"', () => {
    const result = plainExcerpt('y'.repeat(401), 400);
    expect(result).toBe(`${'y'.repeat(399)}…`);
    expect(plainExcerpt('abcdefghij', 5)).toBe('abcd…');
  });

  // plain-excerpt spec: the limit counts Unicode code points of the plain text
  it('applies the limit to the plain text in code points', () => {
    expect(plainExcerpt(`**${'é'.repeat(150)}**`, 150)).toBe('é'.repeat(150));
    const emoji = plainExcerpt('😀'.repeat(200), 150);
    expect([...emoji]).toHaveLength(150);
    expect(emoji.endsWith('…')).toBe(true);
  });

  // plain-excerpt spec: without maxLength the limit stays 100
  it('keeps the limit of 100 without maxLength', () => {
    expect(plainExcerpt('z'.repeat(150))).toBe(`${'z'.repeat(99)}…`);
    expect(plainExcerpt('z'.repeat(150), undefined)).toBe(`${'z'.repeat(99)}…`);
  });
});
