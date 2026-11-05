import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { snapshotTree, tempDir, userEntry, writeHistorySession } from '../test-support.js';
import { type ConversationItem, TranscriptReader, itemsOf } from './transcript-reader.js';

let claudeDir: string;
let reader: TranscriptReader;
const savedConfig = process.env.CLAUDE_CONFIG_DIR;

beforeEach(async () => {
  claudeDir = await tempDir('ai-client-claude-');
  reader = new TranscriptReader({ claudeDir });
});

afterEach(() => {
  if (savedConfig === undefined) delete process.env.CLAUDE_CONFIG_DIR;
  else process.env.CLAUDE_CONFIG_DIR = savedConfig;
});

const assistantEntry = (content: unknown, extra: object = {}) => ({ type: 'assistant', message: { role: 'assistant', content }, ...extra });
const toolUse = (name: string, input?: unknown) => ({ type: 'tool_use', id: 'toolu_1', name, ...(input === undefined ? {} : { input }) });
const toolResult = (content: unknown) => ({ type: 'tool_result', tool_use_id: 'toolu_1', content });
const summaryOf = (input?: unknown) => (itemsOf(assistantEntry([toolUse('Tool', input)]))[0] as { summary: string } | undefined)?.summary;
const resultOf = (content: unknown) => itemsOf(userEntry([toolResult(content)]))[0];

describe('itemsOf', () => {
  // plan-claude_sessions_client/REQ-33: lines that are not conversation give no item
  it('gives no item for a value that is not an object, a sidechain or a meta entry', () => {
    for (const entry of [null, 'text', 42, [userEntry('Ciao')]]) expect(itemsOf(entry)).toEqual([]);
    expect(itemsOf(userEntry('Ciao', undefined, { isSidechain: true }))).toEqual([]);
    expect(itemsOf(userEntry('Ciao', undefined, { isMeta: true }))).toEqual([]);
    expect(itemsOf(assistantEntry([{ type: 'text', text: 'Fatto' }], { isSidechain: true }))).toEqual([]);
  });

  // plan-claude_sessions_client/REQ-33
  it('gives a user item with the user message, by the SessionHistory rule', () => {
    expect(itemsOf(userEntry('  Correggi il bug  '))).toEqual([{ kind: 'user', text: 'Correggi il bug' }]);
    expect(itemsOf(userEntry([{ type: 'text', text: 'Dal blocco' }]))).toEqual([{ kind: 'user', text: 'Dal blocco' }]);
    expect(itemsOf(userEntry('<command-name>/review</command-name><command-args>il login</command-args>'))).toEqual([
      { kind: 'user', text: '/review il login' },
    ]);
  });

  it('gives no user item when the SessionHistory rule finds no message', () => {
    expect(itemsOf(userEntry('<command-name>/clear</command-name><command-args></command-args>'))).toEqual([]);
    expect(itemsOf(userEntry('<local-command-stdout>ok</local-command-stdout>'))).toEqual([]);
    expect(itemsOf(userEntry('   '))).toEqual([]);
  });

  // plan-claude_sessions_client/REQ-33
  it('gives one tool_result item per tool_result block of a user line', () => {
    expect(itemsOf(userEntry([toolResult('primo'), toolResult('secondo')]))).toEqual([
      { kind: 'tool_result', text: 'primo', truncated: false },
      { kind: 'tool_result', text: 'secondo', truncated: false },
    ]);
  });

  it('a tool result from an array keeps the text blocks joined by a newline', () => {
    expect(resultOf([{ type: 'text', text: 'riga a' }, { type: 'image', source: {} }, { type: 'text', text: 'riga b' }])).toEqual({
      kind: 'tool_result',
      text: 'riga a\nriga b',
      truncated: false,
    });
  });

  it('a tool result loses its trailing whitespace and is cut to its first 5 lines', () => {
    expect(resultOf('uno\ndue  \n\n')).toEqual({ kind: 'tool_result', text: 'uno\ndue', truncated: false });
    expect(resultOf('1\n2\n3\n4\n5\n')).toEqual({ kind: 'tool_result', text: '1\n2\n3\n4\n5', truncated: false });
    expect(resultOf('1\n2\n3\n4\n5\n6\n7')).toEqual({ kind: 'tool_result', text: '1\n2\n3\n4\n5', truncated: true });
  });

  // plan-claude_sessions_client/REQ-33
  it('gives an assistant item for a non-blank string content, none for a blank one', () => {
    expect(itemsOf(assistantEntry('Ecco la risposta'))).toEqual([{ kind: 'assistant', text: 'Ecco la risposta' }]);
    expect(itemsOf(assistantEntry('  \n '))).toEqual([]);
  });

  // plan-claude_sessions_client/REQ-33
  it('gives the text and tool_use blocks of an assistant line in order, and skips the others', () => {
    const entry = assistantEntry([
      { type: 'thinking', thinking: 'ragiono' },
      { type: 'text', text: '  Leggo il file.  ' },
      toolUse('Read', { file_path: '/src/app.ts' }),
      { type: 'text', text: '   ' },
      { type: 'text', text: 'Fatto.' },
    ]);
    expect(itemsOf(entry)).toEqual<ConversationItem[]>([
      { kind: 'assistant', text: 'Leggo il file.' },
      { kind: 'tool_call', name: 'Read', summary: '/src/app.ts' },
      { kind: 'assistant', text: 'Fatto.' },
    ]);
  });

  it('gives no item for any other entry type', () => {
    expect(itemsOf({ type: 'system', content: 'x' })).toEqual([]);
    expect(itemsOf({ type: 'file-history-snapshot', snapshot: {} })).toEqual([]);
    expect(itemsOf({ type: 'summary', summary: 'Riassunto' })).toEqual([]);
  });
});

describe('itemsOf tool call summary', () => {
  it('takes the first string among the known input keys, in their order', () => {
    const keys = ['command', 'file_path', 'path', 'pattern', 'url', 'query', 'description', 'prompt'];
    for (let i = 0; i < keys.length; i += 1) {
      const input = Object.fromEntries(keys.slice(i).reverse().map((key) => [key, `valore-${key}`]));
      expect(summaryOf({ other: 'altro', ...input })).toBe(`valore-${keys[i]}`);
    }
  });

  it('skips a known key whose value is not a string', () => {
    expect(summaryOf({ command: 42, file_path: '/a.txt' })).toBe('/a.txt');
  });

  it('falls back to the first string value, then to the JSON of the input, then to ""', () => {
    expect(summaryOf({ count: 3, name: 'primo', other: 'secondo' })).toBe('primo');
    expect(summaryOf({ count: 3, flag: true })).toBe('{"count":3,"flag":true}');
    expect(summaryOf()).toBe('');
  });

  it('collapses whitespace to one space, trims, and cuts to 120 characters plus "…"', () => {
    expect(summaryOf({ command: '  npm \n run\t\tbuild  ' })).toBe('npm run build');
    const exact = 'a'.repeat(120);
    expect(summaryOf({ command: exact })).toBe(exact);
    expect(summaryOf({ command: `${exact}bcd` })).toBe(`${exact}…`);
  });
});

describe('TranscriptReader.locate', () => {
  // plan-claude_sessions_client/REQ-33
  it('finds <projects>/<cwd with every non-alphanumeric character replaced by "-">/<sessionId>.jsonl', async () => {
    const file = await writeHistorySession(claudeDir, '-home-dev-my-app-v2', 'sess-1', [userEntry('Ciao')]);
    await writeHistorySession(claudeDir, 'other-folder', 'sess-1', [userEntry('Altro')]);
    expect(await reader.locate('/home/dev/my_app.v2', 'sess-1')).toBe(file);
  });

  it('falls back to a <sessionId>.jsonl in any project folder', async () => {
    const file = await writeHistorySession(claudeDir, 'renamed-project', 'sess-2', [userEntry('Ciao')]);
    expect(await reader.locate('/home/dev/app', 'sess-2')).toBe(file);
  });

  it('is undefined when no file exists, or with an invalid sessionId', async () => {
    expect(await reader.locate('/home/dev/app', 'missing')).toBeUndefined();
    await writeHistorySession(claudeDir, '-home-dev-app', 'a.b', [userEntry('Ciao')]);
    expect(await reader.locate('/home/dev/app', 'a.b')).toBeUndefined();
    expect(await reader.locate('/home/dev/app', '../-home-dev-app/a')).toBeUndefined();
  });

  it('is undefined when there is no projects folder', async () => {
    expect(await new TranscriptReader({ claudeDir: await tempDir('ai-client-claude-empty-') }).locate('/x', 'sess')).toBeUndefined();
  });

  it('uses the default Claude Code folder without options', async () => {
    const file = await writeHistorySession(claudeDir, '-work', 'sess-default', [userEntry('Ciao')]);
    process.env.CLAUDE_CONFIG_DIR = claudeDir;
    expect(await new TranscriptReader().locate('/work', 'sess-default')).toBe(file);
  });
});

describe('TranscriptReader.readFrom', () => {
  const line = (entry: object) => `${JSON.stringify(entry)}\n`;
  let file: string;

  beforeEach(async () => {
    await mkdir(path.join(claudeDir, 'projects', '-p'), { recursive: true });
    file = path.join(claudeDir, 'projects', '-p', 'sess.jsonl');
  });

  // plan-claude_sessions_client/REQ-33, REQ-34
  it('gives the items of the complete lines and the byte offset after the last one', async () => {
    const content = line(userEntry('Perché è così?')) + line({ type: 'system' }) + line(assistantEntry([{ type: 'text', text: 'Perché sì.' }]));
    await writeFile(file, content);
    expect(await reader.readFrom(file, 0)).toEqual({
      items: [
        { kind: 'user', text: 'Perché è così?' },
        { kind: 'assistant', text: 'Perché sì.' },
      ],
      offset: Buffer.byteLength(content),
    });
  });

  // plan-claude_sessions_client/REQ-34
  it('reads only after the offset, and leaves a partial last line to a later call', async () => {
    const first = line(userEntry('Uno'));
    const second = line(userEntry('Due'));
    await writeFile(file, first + second.slice(0, 10));
    const start = await reader.readFrom(file, 0);
    expect(start).toEqual({ items: [{ kind: 'user', text: 'Uno' }], offset: Buffer.byteLength(first) });
    expect(await reader.readFrom(file, start.offset)).toEqual({ items: [], offset: start.offset });
    await appendFile(file, second.slice(10));
    expect(await reader.readFrom(file, start.offset)).toEqual({
      items: [{ kind: 'user', text: 'Due' }],
      offset: Buffer.byteLength(first + second),
    });
  });

  it('skips lines that are not valid JSON', async () => {
    const content = `{broken\n${line(userEntry('Valida'))}`;
    await writeFile(file, content);
    expect(await reader.readFrom(file, 0)).toEqual({ items: [{ kind: 'user', text: 'Valida' }], offset: Buffer.byteLength(content) });
  });

  it('gives no items and the same offset for a file shorter than the offset or a file that cannot be read', async () => {
    await writeFile(file, line(userEntry('Corta')));
    expect(await reader.readFrom(file, 10_000)).toEqual({ items: [], offset: 10_000 });
    expect(await reader.readFrom(path.join(claudeDir, 'projects', '-p', 'missing.jsonl'), 7)).toEqual({ items: [], offset: 7 });
  });

  // plan-claude_sessions_client/REQ-36
  it('locate and readFrom change nothing under claudeDir', async () => {
    await writeFile(file, line(userEntry('Intatto')) + '{"partial');
    const before = await snapshotTree(claudeDir);
    await reader.locate('/p', 'sess');
    await reader.readFrom(file, 0);
    await reader.locate('/elsewhere', 'missing');
    expect(await snapshotTree(claudeDir)).toEqual(before);
  });
});
