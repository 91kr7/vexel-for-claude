import { appendFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tempDir } from '../test-support.js';
import { TranscriptReader } from './transcript-reader.js';

let dir: string;
let file: string;
const reader = new TranscriptReader({ claudeDir: '/nonexistent-claude-dir' });
const line = (value: unknown) => `${JSON.stringify(value)}\n`;
const bytes = (text: string) => Buffer.byteLength(text);

beforeEach(async () => {
  dir = await tempDir('ai-client-entries-');
  file = path.join(dir, 'transcript.jsonl');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('TranscriptReader.readEntriesFrom', () => {
  // plan-session_usage/REQ-3: the parsed lines keep every field, usage included, in file order
  it('gives the parsed objects of the complete lines, in file order, with no conversion', async () => {
    const first = { type: 'assistant', message: { id: 'm1', usage: { input_tokens: 5 } } };
    const second = { type: 'system', subtype: 'compact_boundary' };
    const text = line(first) + line(second);
    await writeFile(file, text);
    expect(await reader.readEntriesFrom(file, 0)).toEqual({ entries: [first, second], offset: bytes(text), more: false });
  });

  // TranscriptReader spec: invalid JSON, arrays and non-objects give nothing
  it('skips lines that are not a JSON object', async () => {
    const text = `not json\n${line([1, 2])}${line('text')}${line(7)}${line(null)}\n${line({ type: 'user' })}`;
    await writeFile(file, text);
    expect(await reader.readEntriesFrom(file, 0)).toEqual({ entries: [{ type: 'user' }], offset: bytes(text), more: false });
  });

  // TranscriptReader spec: a partial last line is read by a later call; the offset stops after the last complete line
  it('leaves a partial last line for a later call', async () => {
    const complete = line({ n: 1 });
    await writeFile(file, `${complete}{"n":`);
    const first = await reader.readEntriesFrom(file, 0);
    expect(first).toEqual({ entries: [{ n: 1 }], offset: bytes(complete), more: false });
    await appendFile(file, '2}\n');
    expect(await reader.readEntriesFrom(file, first.offset)).toEqual({ entries: [{ n: 2 }], offset: bytes(complete) + bytes('{"n":2}\n'), more: false });
  });

  // TranscriptReader spec: only the lines after offset
  it('reads only after the given offset', async () => {
    const head = line({ n: 1 });
    await writeFile(file, head + line({ n: 2 }));
    expect((await reader.readEntriesFrom(file, bytes(head))).entries).toEqual([{ n: 2 }]);
  });

  // TranscriptReader spec: a file shorter than offset, or a file that cannot be read → no entries, same offset, more false
  it('gives no entries and the same offset for a shorter file or a missing file', async () => {
    await writeFile(file, line({ n: 1 }));
    expect(await reader.readEntriesFrom(file, 500)).toEqual({ entries: [], offset: 500, more: false });
    expect(await reader.readEntriesFrom(path.join(dir, 'missing.jsonl'), 12)).toEqual({ entries: [], offset: 12, more: false });
  });

  // plan-session_usage/REQ-21: maxBytes bounds a call; more tells that the file goes on
  it('stops at maxBytes with more true, and goes on from the returned offset', async () => {
    const lines = Array.from({ length: 10 }, (_, n) => line({ n, pad: 'x'.repeat(20) }));
    await writeFile(file, lines.join(''));
    const size = bytes(lines[0]!);
    const first = await reader.readEntriesFrom(file, 0, size * 3);
    expect(first.entries).toEqual([0, 1, 2].map((n) => ({ n, pad: 'x'.repeat(20) })));
    expect(first).toMatchObject({ offset: size * 3, more: true });

    const seen = [...first.entries];
    let { offset, more } = first;
    let calls = 1;
    while (more) {
      const next = await reader.readEntriesFrom(file, offset, size * 3);
      seen.push(...next.entries);
      ({ offset, more } = next);
      calls += 1;
      expect(calls, 'the reading ends').toBeLessThan(10);
    }
    expect(seen.map((entry) => entry.n)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(offset).toBe(size * 10);
  });

  // TranscriptReader spec: a line longer than maxBytes is read whole, so the reading moves on
  it('reads whole a single line longer than maxBytes', async () => {
    const long = line({ big: 'y'.repeat(500) });
    const short = line({ n: 2 });
    await writeFile(file, long + short);
    const first = await reader.readEntriesFrom(file, 0, 50);
    expect(first.entries).toEqual([{ big: 'y'.repeat(500) }]);
    expect(first.offset).toBe(bytes(long));
    expect(first.more).toBe(true);
    expect(await reader.readEntriesFrom(file, first.offset, 50)).toEqual({ entries: [{ n: 2 }], offset: bytes(long + short), more: false });
  });

  // TranscriptReader spec: more is false when the call reaches the end of the file, a partial last line included
  it('gives more false when only a partial line is left after maxBytes', async () => {
    const complete = line({ n: 1 });
    await writeFile(file, `${complete}{"partial":`);
    expect(await reader.readEntriesFrom(file, 0, bytes(complete) + 100)).toEqual({ entries: [{ n: 1 }], offset: bytes(complete), more: false });
  });
});
