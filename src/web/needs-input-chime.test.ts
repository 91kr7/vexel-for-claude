// Tests of plan-input_sound, batch needs-input-sound: NeedsInputChime spec, read from the WAV header and samples.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const wav = readFileSync(new URL('./sounds/needs-input-chime.wav', import.meta.url));

/** The chunks of a RIFF/WAVE file, by id. */
function chunks(file: Buffer): Map<string, Buffer> {
  expect(file.toString('ascii', 0, 4)).toBe('RIFF');
  expect(file.toString('ascii', 8, 12)).toBe('WAVE');
  const found = new Map<string, Buffer>();
  for (let offset = 12; offset + 8 <= file.length; ) {
    const size = file.readUInt32LE(offset + 4);
    found.set(file.toString('ascii', offset, offset + 4), file.subarray(offset + 8, offset + 8 + size));
    offset += 8 + size + (size % 2);
  }
  return found;
}

const parts = chunks(wav);
const fmt = parts.get('fmt ')!;
const data = parts.get('data')!;

describe('NeedsInputChime', () => {
  // NeedsInputChime contract: PCM, 16 bit, mono, 24000 Hz
  it('is a 16-bit mono PCM WAV at 24000 Hz', () => {
    expect(fmt.readUInt16LE(0)).toBe(1);
    expect(fmt.readUInt16LE(2)).toBe(1);
    expect(fmt.readUInt32LE(4)).toBe(24000);
    expect(fmt.readUInt16LE(14)).toBe(16);
  });

  // plan-input_sound/REQ-9: at most 2 seconds; the spec gives 0.7 s
  it('lasts at most 2 seconds', () => {
    const seconds = data.length / fmt.readUInt32LE(8);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(2);
    expect(seconds).toBeCloseTo(0.7, 1);
  });

  // NeedsInputChime contract: peak level 35 % of full scale, a moderate level
  it('peaks near 35 % of full scale', () => {
    let peak = 0;
    for (let offset = 0; offset + 1 < data.length; offset += 2) peak = Math.max(peak, Math.abs(data.readInt16LE(offset)));
    expect(peak / 32768).toBeGreaterThan(0.3);
    expect(peak / 32768).toBeLessThanOrEqual(0.36);
  });
});
