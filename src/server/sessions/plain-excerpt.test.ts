import { describe, expect, it } from 'vitest';
import { plainExcerpt } from './plain-excerpt.js';

describe('plainExcerpt', () => {
  // plan-session_notifications/REQ-16, scenario "A finished turn shows the start of Claude's answer"
  it('removes the bold marks of the acceptance scenario', () => {
    expect(plainExcerpt('**Done.** The tests pass.')).toBe('Done. The tests pass.');
  });

  it('removes code fence lines and keeps the lines between two fences as written', () => {
    expect(plainExcerpt('Run:\n```bash\nnpm **test** `x`\n```\nDone.')).toBe('Run: npm **test** `x` Done.');
    expect(plainExcerpt('Run:\n  ~~~\n# not a heading\n  ~~~\nDone.')).toBe('Run: # not a heading Done.');
  });

  it('removes heading marks of 1 to 6 "#" followed by a space, also after spaces', () => {
    expect(plainExcerpt('# Title')).toBe('Title');
    expect(plainExcerpt('###### Six')).toBe('Six');
    expect(plainExcerpt('   ## Indented')).toBe('Indented');
  });

  it('keeps "#" runs that are not heading marks', () => {
    expect(plainExcerpt('####### Seven')).toBe('####### Seven');
    expect(plainExcerpt('#hashtag here')).toBe('#hashtag here');
  });

  it('removes list marks "-", "*", "+", "1." and "1)" followed by a space, also after spaces', () => {
    expect(plainExcerpt('- one\n* two\n+ three\n1. four\n1) five\n  - six')).toBe('one two three four five six');
  });

  it('keeps the text of inline code as written', () => {
    expect(plainExcerpt('Run `npm **test**` now')).toBe('Run npm **test** now');
  });

  it('keeps the text of links and images', () => {
    expect(plainExcerpt('See [the docs](https://example.com/docs) and ![the chart](chart.png).')).toBe('See the docs and the chart.');
  });

  it('removes the emphasis marks **, __, *, _ and ~~', () => {
    expect(plainExcerpt('**bold** __strong__ *italic* _em_ ~~gone~~')).toBe('bold strong italic em gone');
  });

  it('keeps a mark with a space right after the opening or right before the closing one', () => {
    expect(plainExcerpt('2 * 3 * 4')).toBe('2 * 3 * 4');
  });

  it('keeps "_" inside a word', () => {
    expect(plainExcerpt('Renamed file_name_here today')).toBe('Renamed file_name_here today');
  });

  it('joins the lines by a space, collapses whitespace runs and trims the ends', () => {
    expect(plainExcerpt('  Hello\n\n  world \t again  \n')).toBe('Hello world again');
  });

  it('gives "" for a markdown with no text', () => {
    expect(plainExcerpt('')).toBe('');
    expect(plainExcerpt('  \n\t\n')).toBe('');
    expect(plainExcerpt('```\n```')).toBe('');
  });

  // plan-session_notifications/REQ-16: at most 100 characters
  it('keeps a text of exactly 100 characters', () => {
    const text = 'a'.repeat(100);
    expect(plainExcerpt(text)).toBe(text);
  });

  it('cuts a text longer than 100 characters to the first 99 and "…"', () => {
    expect(plainExcerpt('b'.repeat(101))).toBe(`${'b'.repeat(99)}…`);
  });

  it('applies the limit to the plain text, not to the markdown', () => {
    expect(plainExcerpt(`**${'c'.repeat(98)}**`)).toBe('c'.repeat(98));
    expect(plainExcerpt(`**${'d'.repeat(100)}**`)).toBe('d'.repeat(100));
    expect(plainExcerpt(`**${'d'.repeat(101)}**`)).toBe(`${'d'.repeat(99)}…`);
  });

  it('counts Unicode code points, not UTF-16 units', () => {
    const hundred = '😀'.repeat(100);
    expect(plainExcerpt(hundred)).toBe(hundred);
    const cut = plainExcerpt('😀'.repeat(101));
    expect([...cut]).toHaveLength(100);
    expect(cut).toBe(`${'😀'.repeat(99)}…`);
  });
});
