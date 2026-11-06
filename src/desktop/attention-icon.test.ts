// Tests of plan-session_notifications, batch tray-signal: AttentionIcon spec.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const icon = (file: string) => readFileSync(new URL(`./icons/${file}`, import.meta.url));

describe('AttentionIcon', () => {
  // plan-session_notifications/REQ-30: a 256 px PNG with transparency, other than the AppIcon
  it('is a 256 × 256 RGBA PNG that differs from the AppIcon PNG', () => {
    const png = icon('vexel-for-claude-attention.png');
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(png.subarray(12, 16).toString('latin1')).toBe('IHDR');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([256, 256]);
    expect({ bitDepth: png[24], colourType: png[25] }).toEqual({ bitDepth: 8, colourType: 6 });
    expect(png.equals(icon('vexel-for-claude.png'))).toBe(false);
  });

  // plan-session_notifications/REQ-31: amber core, dark ring, light ring
  it('draws the badge in amber-500, with a dark and a light ring', () => {
    const svg = icon('vexel-for-claude-attention.svg').toString('utf8').toLowerCase();
    for (const colour of ['#f59e0b', '#0b0b0e', '#ffffff']) expect(svg, colour).toContain(colour);
  });
});
