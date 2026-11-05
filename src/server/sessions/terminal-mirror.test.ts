import { describe, expect, it } from 'vitest';
import { renderLines } from '../test-support.js';
import { TerminalMirror } from './terminal-mirror.js';

const numbered = (n: number) => `L${String(n).padStart(5, '0')}`;

describe('TerminalMirror', () => {
  it('snapshot contains data written right before the call', async () => {
    const mirror = new TerminalMirror(80, 24);
    mirror.write('first line\r\n');
    mirror.write('just-written');
    const snapshot = await mirror.snapshot();
    expect(snapshot).toContain('first line');
    expect(snapshot).toContain('just-written');
  });

  it('replaying the snapshot into an empty terminal of the same size reproduces the screen', async () => {
    const mirror = new TerminalMirror(40, 10);
    const output =
      'plain text\r\n\x1b[31mred\x1b[0m and \x1b[1mbold\x1b[0m\r\n' +
      'a line longer than forty columns that wraps onto the next row\r\n' +
      '\x1b[5;10Hplaced\x1b[2;1Hover';
    mirror.write(output);
    const expected = await renderLines(output, 40, 10);
    const replayed = await renderLines(await mirror.snapshot(), 40, 10);
    expect(replayed).toEqual(expected);
  });

  it('snapshot includes the scrollback, not only the visible screen', async () => {
    const mirror = new TerminalMirror(80, 10);
    for (let n = 1; n <= 100; n += 1) mirror.write(`${numbered(n)}\r\n`);
    const lines = await renderLines(await mirror.snapshot(), 80, 10);
    expect(lines[0]).toBe(numbered(1));
    expect(lines.at(-1)).toBe(numbered(100));
  });

  it('keeps at most 10 000 lines of scrollback and drops the oldest', async () => {
    const rows = 30;
    const mirror = new TerminalMirror(80, rows);
    const total = 10_500;
    let chunk = '';
    for (let n = 1; n <= total; n += 1) chunk += `${numbered(n)}\r\n`;
    mirror.write(chunk);
    const lines = await renderLines(await mirror.snapshot(), 80, rows);
    // Scrollback plus screen hold 10 000 + rows lines, the last one being the empty cursor line.
    const firstKept = total - (10_000 + rows - 1) + 1;
    expect(lines[0]).toBe(numbered(firstKept));
    expect(lines.at(-1)).toBe(numbered(total));
    expect(lines).toHaveLength(total - firstKept + 1);
  });

  it('resize changes the size used for new output', async () => {
    const mirror = new TerminalMirror(80, 10);
    mirror.resize(20, 10);
    mirror.write('x'.repeat(30));
    const lines = await renderLines(await mirror.snapshot(), 20, 10);
    expect(lines).toEqual(['x'.repeat(20), 'x'.repeat(10)]);
  });
});
