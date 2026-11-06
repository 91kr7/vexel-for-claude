import { appendFile, chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TranscriptReader } from '../external/transcript-reader.js';
import { delay, tempDir, writeHistorySession } from '../test-support.js';
import { TurnReader } from './turn-reader.js';

const TAIL_BYTES = 128 * 1024;
const FAST_RETRY_MS = 30;

type Line = object | string;

const prompt = (text: string) => ({ type: 'user', message: { role: 'user', content: text } });
const reply = (...texts: string[]) => ({
  type: 'assistant',
  message: { role: 'assistant', content: texts.map((text) => ({ type: 'text', text })) },
});
const toolCall = (name = 'Bash', command = 'npm test') => ({
  type: 'assistant',
  message: { role: 'assistant', content: [{ type: 'tool_use', id: 'tu-1', name, input: { command } }] },
});
const toolResult = (text = 'ok') => ({
  type: 'user',
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu-1', content: text }] },
});
const marker = (text = '[Request interrupted by user]') => ({ type: 'user', message: { role: 'user', content: [{ type: 'text', text }] } });
// A valid transcript line that gives no conversation item.
const noItem = (padding: number) => ({ type: 'system', content: 'x'.repeat(padding) });

const serialize = (line: Line) => (typeof line === 'string' ? line : JSON.stringify(line));

let dir: string;

beforeEach(async () => {
  dir = await tempDir('ai-client-turn-reader-');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function transcript(lines: Line[], partialLast?: Line): Promise<string> {
  const file = path.join(dir, 'session.jsonl');
  const complete = lines.map((line) => `${serialize(line)}\n`).join('');
  await writeFile(file, complete + (partialLast === undefined ? '' : serialize(partialLast)));
  return file;
}

/** A TurnReader whose `locate` always gives `file`. */
function readerOf(file: string | undefined, retryMs = FAST_RETRY_MS) {
  const locate = vi.fn(async (_cwd: string, _sessionId: string) => file);
  return { reader: new TurnReader({ transcripts: { locate }, retryMs }), locate };
}

describe('TurnReader.lastTurn transcript', () => {
  it('locates the transcript with the folder and the Claude Code session id', async () => {
    const { reader, locate } = readerOf(await transcript([prompt('Go'), reply('Done.')]));
    await reader.lastTurn('/projects/ai-client', 'abc-123');
    expect(locate).toHaveBeenCalledWith('/projects/ai-client', 'abc-123');
  });

  it('finds the transcript in the Claude Code folder through TranscriptReader', async () => {
    const folder = '/projects/ai-client';
    await writeHistorySession(dir, folder.replace(/[^A-Za-z0-9]/g, '-'), 'abc-123', [prompt('Go'), reply('All done.')]);
    const reader = new TurnReader({ transcripts: new TranscriptReader({ claudeDir: dir }), retryMs: FAST_RETRY_MS });
    expect(await reader.lastTurn(folder, 'abc-123')).toEqual({ interrupted: false, finalResponse: 'All done.' });
  });

  it('gives no final response when there is no transcript', async () => {
    const { reader } = readerOf(undefined);
    expect(await reader.lastTurn('/projects/ai-client', 'abc-123')).toEqual({ interrupted: false });
  });

  it('never rejects: a missing file, a folder or a failing locate give no final response', async () => {
    const folder = path.join(dir, 'a-folder');
    await mkdir(folder);
    for (const file of [path.join(dir, 'missing.jsonl'), folder]) {
      expect(await readerOf(file).reader.lastTurn('/projects/ai-client', 'abc-123')).toEqual({ interrupted: false });
    }
    const failing = new TurnReader({ transcripts: { locate: async () => Promise.reject(new Error('EACCES')) }, retryMs: FAST_RETRY_MS });
    await expect(failing.lastTurn('/projects/ai-client', 'abc-123')).resolves.toEqual({ interrupted: false });
  });

  it('opens the transcript read-only', async () => {
    const file = await transcript([prompt('Go'), reply('Read only.')]);
    await chmod(file, 0o444);
    expect(await readerOf(file).reader.lastTurn('/projects/ai-client', 'abc-123')).toEqual({ interrupted: false, finalResponse: 'Read only.' });
  });
});

describe('TurnReader.lastTurn final response', () => {
  // plan-session_notifications/REQ-16
  it('gives the reply of Claude when it is the last item', async () => {
    const { reader } = readerOf(await transcript([prompt('Fix it'), reply('All done.')]));
    expect(await reader.lastTurn('/projects/ai-client', 'abc-123')).toEqual({ interrupted: false, finalResponse: 'All done.' });
  });

  it('joins by "\\n" the texts of Claude after the last tool result', async () => {
    const { reader } = readerOf(
      await transcript([prompt('Fix it'), reply('Let me check.'), toolCall(), toolResult(), reply('First part.', 'Second part.'), reply('Third part.')]),
    );
    expect(await reader.lastTurn('/projects/ai-client', 'abc-123')).toEqual({
      interrupted: false,
      finalResponse: 'First part.\nSecond part.\nThird part.',
    });
  });

  it('takes only the texts after the last user message', async () => {
    const { reader } = readerOf(await transcript([prompt('One'), reply('Old answer.'), prompt('Two'), reply('New answer.')]));
    expect(await reader.lastTurn('/projects/ai-client', 'abc-123')).toEqual({ interrupted: false, finalResponse: 'New answer.' });
  });

  // plan-session_notifications/REQ-17
  it('gives no final response when the turn ends with a tool call', async () => {
    const { reader } = readerOf(await transcript([prompt('Fix it'), reply('Running the tests.'), toolCall()]));
    expect(await reader.lastTurn('/projects/ai-client', 'abc-123')).toEqual({ interrupted: false });
  });

  it('gives no final response when the last item is a tool result or a user message', async () => {
    for (const last of [toolResult(), prompt('Another prompt')]) {
      const { reader } = readerOf(await transcript([prompt('Fix it'), reply('Earlier text.'), toolCall(), last]));
      expect(await reader.lastTurn('/projects/ai-client', 'abc-123')).toEqual({ interrupted: false });
    }
  });

  it('gives no final response for a transcript with no item', async () => {
    const { reader } = readerOf(await transcript([noItem(10)]));
    expect(await reader.lastTurn('/projects/ai-client', 'abc-123')).toEqual({ interrupted: false });
  });

  it('ignores a line that is not valid JSON', async () => {
    const { reader } = readerOf(await transcript([prompt('Fix it'), reply('Valid answer.'), 'not json {']));
    expect(await reader.lastTurn('/projects/ai-client', 'abc-123')).toEqual({ interrupted: false, finalResponse: 'Valid answer.' });
  });

  it('ignores a last line with no newline', async () => {
    const { reader } = readerOf(await transcript([prompt('Fix it'), toolCall(), toolResult()], reply('Not written yet.')));
    expect(await reader.lastTurn('/projects/ai-client', 'abc-123')).toEqual({ interrupted: false });
  });
});

describe('TurnReader.lastTurn interrupt', () => {
  // plan-session_notifications/REQ-15: the two markers of Claude Code
  it('reports an interrupt when the last line is the interrupt marker', async () => {
    for (const text of ['[Request interrupted by user]', '[Request interrupted by user for tool use]']) {
      const { reader } = readerOf(await transcript([prompt('Fix it'), reply('Starting.'), toolCall(), marker(text)]));
      expect(await reader.lastTurn('/projects/ai-client', 'abc-123')).toEqual({ interrupted: true });
    }
  });

  // plan-session_notifications/REQ-15: the marker counts on the last line that gives items, not only as the last item
  it('reports an interrupt when the last line has the marker next to a tool result', async () => {
    const line = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          { type: 'text', text: '[Request interrupted by user for tool use]' },
          { type: 'tool_result', tool_use_id: 'tu-1', content: 'The user rejected the tool use.', is_error: true },
        ],
      },
    };
    const { reader } = readerOf(await transcript([prompt('Fix it'), toolCall(), line]));
    expect(await reader.lastTurn('/projects/ai-client', 'abc-123')).toEqual({ interrupted: true });
  });

  it('does not count the interrupt of an earlier turn', async () => {
    const { reader } = readerOf(await transcript([prompt('Fix it'), toolCall(), marker(), prompt('Go on'), reply('Finished.')]));
    expect(await reader.lastTurn('/projects/ai-client', 'abc-123')).toEqual({ interrupted: false, finalResponse: 'Finished.' });
  });
});

describe('TurnReader.lastTurn second read', () => {
  // plan-session_notifications/REQ-2: a complete read does not wait
  it('answers at once when the read is complete', async () => {
    for (const lines of [[prompt('Fix it'), reply('Done.')], [prompt('Fix it'), marker()]]) {
      const { reader } = readerOf(await transcript(lines), 60_000);
      const startedAt = Date.now();
      await reader.lastTurn('/projects/ai-client', 'abc-123');
      expect(Date.now() - startedAt).toBeLessThan(1000);
    }
  });

  it('reads once more after retryMs when the last reply is not written yet', async () => {
    const retryMs = 300;
    const file = await transcript([prompt('Fix it'), toolCall(), toolResult()]);
    const { reader } = readerOf(file, retryMs);
    const startedAt = Date.now();
    const pending = reader.lastTurn('/projects/ai-client', 'abc-123');
    await delay(100);
    await appendFile(file, `${JSON.stringify(reply('Written late.'))}\n`);

    expect(await pending).toEqual({ interrupted: false, finalResponse: 'Written late.' });
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(retryMs - 20);
  });

  it('sees on the second read an interrupt marker written late', async () => {
    const file = await transcript([prompt('Fix it'), toolCall()]);
    const { reader } = readerOf(file, 300);
    const pending = reader.lastTurn('/projects/ai-client', 'abc-123');
    await delay(100);
    await appendFile(file, `${JSON.stringify(marker('[Request interrupted by user for tool use]'))}\n`);

    expect(await pending).toEqual({ interrupted: true });
  });

  it('reads only once more', async () => {
    const retryMs = 50;
    const file = await transcript([prompt('Fix it'), toolCall()]);
    const { reader } = readerOf(file, retryMs);
    const startedAt = Date.now();
    const pending = reader.lastTurn('/projects/ai-client', 'abc-123');
    const lateWrite = delay(600).then(() => appendFile(file, `${JSON.stringify(reply('Too late.'))}\n`));

    expect(await pending).toEqual({ interrupted: false });
    expect(Date.now() - startedAt).toBeLessThan(600);
    await lateWrite;
  });

  it('waits 1 second by default before the second read', async () => {
    const file = await transcript([prompt('Fix it'), toolCall(), toolResult()]);
    const reader = new TurnReader({ transcripts: { locate: async () => file } });
    const startedAt = Date.now();
    const pending = reader.lastTurn('/projects/ai-client', 'abc-123');
    await delay(700);
    await appendFile(file, `${JSON.stringify(reply('After 700 ms.'))}\n`);

    expect(await pending).toEqual({ interrupted: false, finalResponse: 'After 700 ms.' });
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(980);
  });
});

describe('TurnReader.lastTurn file tail', () => {
  it('ignores the lines that start before the last 128 KiB', async () => {
    const { reader } = readerOf(await transcript([prompt('Fix it'), reply('Early answer.'), noItem(TAIL_BYTES + 10_000)]));
    expect(await reader.lastTurn('/projects/ai-client', 'abc-123')).toEqual({ interrupted: false });
  });

  it('reads the lines that start inside the last 128 KiB, after a longer one', async () => {
    const { reader } = readerOf(await transcript([noItem(2 * TAIL_BYTES), prompt('Fix it'), reply('Tail answer.')]));
    expect(await reader.lastTurn('/projects/ai-client', 'abc-123')).toEqual({ interrupted: false, finalResponse: 'Tail answer.' });
  });

  it('reads a line that starts exactly 128 KiB before the end', async () => {
    const shell = JSON.stringify({ ...reply('Exact answer.'), pad: '' });
    const last = { ...reply('Exact answer.'), pad: 'x'.repeat(TAIL_BYTES - 1 - Buffer.byteLength(shell)) };
    expect(Buffer.byteLength(`${JSON.stringify(last)}\n`)).toBe(TAIL_BYTES);
    const { reader } = readerOf(await transcript([toolCall(), toolResult(), last]));
    expect(await reader.lastTurn('/projects/ai-client', 'abc-123')).toEqual({ interrupted: false, finalResponse: 'Exact answer.' });
  });
});
