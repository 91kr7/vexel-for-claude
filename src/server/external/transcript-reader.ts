import { type FileHandle, open, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { defaultClaudeDir, userMessageOf } from '../history/session-history.js';

export interface ItemRef {
  offset: number;
  block: number;
}

export type ConversationItem =
  | { kind: 'user'; text: string; timestamp?: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool_call'; name: string; summary: string; moreInput?: true; id?: string; ref?: ItemRef }
  | { kind: 'tool_result'; text: string; truncated: boolean; isError?: true; toolUseId?: string; ref?: ItemRef };

export interface TranscriptReaderOptions {
  claudeDir?: string;
}

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const RESULT_LINES = 5;
const SUMMARY_LENGTH = 120;
const SUMMARY_KEYS = ['command', 'file_path', 'path', 'pattern', 'url', 'query', 'description', 'prompt'];
const NEWLINE = 0x0a;
const LINE_CHUNK_BYTES = 64 * 1024;

type Block = Record<string, unknown>;

const isBlock = (value: unknown): value is Block => typeof value === 'object' && value !== null;

function blocksOf(content: unknown): Block[] {
  return Array.isArray(content) ? content.filter(isBlock) : [];
}

function indexedBlocksOf(content: unknown): { block: Block; index: number }[] {
  return Array.isArray(content) ? content.flatMap((block, index) => (isBlock(block) ? [{ block, index }] : [])) : [];
}

function withRef<T extends ConversationItem>(item: T, lineOffset: number | undefined, block: number): T {
  return lineOffset === undefined ? item : { ...item, ref: { offset: lineOffset, block } };
}

function resultTextOf(block: Block): string {
  const text =
    typeof block.content === 'string'
      ? block.content
      : blocksOf(block.content)
          .filter((part) => part.type === 'text' && typeof part.text === 'string')
          .map((part) => part.text as string)
          .join('\n');
  return text.trimEnd();
}

function toolResultItem(block: Block): ConversationItem {
  const lines = resultTextOf(block).split('\n');
  return {
    kind: 'tool_result',
    text: lines.slice(0, RESULT_LINES).join('\n'),
    truncated: lines.length > RESULT_LINES,
    ...(block.is_error === true && { isError: true }),
    ...(typeof block.tool_use_id === 'string' && { toolUseId: block.tool_use_id }),
  };
}

export function mainArgumentOf(input: unknown): string | undefined {
  if (typeof input !== 'object' || input === null) return undefined;
  const record = input as Record<string, unknown>;
  const preferred = SUMMARY_KEYS.map((key) => record[key]).find((item) => typeof item === 'string');
  return (preferred ?? Object.values(record).find((item) => typeof item === 'string')) as string | undefined;
}

function summaryOf(input: unknown): string {
  const value = mainArgumentOf(input) ?? (input === undefined ? '' : JSON.stringify(input));
  const line = Array.from(value.replace(/\s+/g, ' ').trim());
  return line.length > SUMMARY_LENGTH ? `${line.slice(0, SUMMARY_LENGTH).join('')}…` : line.join('');
}

function hasMoreInput(input: unknown, summary: string): boolean {
  if (input === undefined) return false;
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return true;
  const values = Object.values(input);
  if (values.length === 0) return false;
  return !(values.length === 1 && values[0] === summary);
}

function toolCallItem(block: Block): ConversationItem {
  const summary = summaryOf(block.input);
  return {
    kind: 'tool_call',
    name: typeof block.name === 'string' ? block.name : '',
    summary,
    ...(hasMoreInput(block.input, summary) && { moreInput: true }),
    ...(typeof block.id === 'string' && { id: block.id }),
  };
}

function assistantItems(content: unknown, lineOffset: number | undefined): ConversationItem[] {
  if (typeof content === 'string') return content.trim() ? [{ kind: 'assistant', text: content.trim() }] : [];
  const items: ConversationItem[] = [];
  for (const { block, index } of indexedBlocksOf(content)) {
    if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
      items.push({ kind: 'assistant', text: block.text.trim() });
    } else if (block.type === 'tool_use') {
      items.push(withRef(toolCallItem(block), lineOffset, index));
    }
  }
  return items;
}

function conversationEntryOf(entry: unknown): Record<string, unknown> | undefined {
  if (!isBlock(entry) || Array.isArray(entry)) return undefined;
  return entry.isSidechain === true || entry.isMeta === true ? undefined : entry;
}

const contentOf = (record: Record<string, unknown>): unknown => (record.message as { content?: unknown } | undefined)?.content;

export function itemsOf(entry: unknown, lineOffset?: number): ConversationItem[] {
  const record = conversationEntryOf(entry);
  if (!record) return [];
  const content = contentOf(record);
  if (record.type === 'assistant') return assistantItems(content, lineOffset);
  if (record.type !== 'user') return [];
  const items: ConversationItem[] = [];
  const text = userMessageOf(record);
  if (text !== null) items.push({ kind: 'user', text, ...(typeof record.timestamp === 'string' && { timestamp: record.timestamp }) });
  for (const { block, index } of indexedBlocksOf(content)) {
    if (block.type === 'tool_result') items.push(withRef(toolResultItem(block), lineOffset, index));
  }
  return items;
}

function fullContentOf(entry: unknown, blockIndex: number): string | undefined {
  const record = conversationEntryOf(entry);
  const content = record && contentOf(record);
  const block: unknown = Array.isArray(content) ? content[blockIndex] : undefined;
  if (!record || !isBlock(block)) return undefined;
  if (record.type === 'assistant' && block.type === 'tool_use') {
    return block.input === undefined ? '' : JSON.stringify(block.input, null, 2);
  }
  if (record.type === 'user' && block.type === 'tool_result') return resultTextOf(block);
  return undefined;
}

function parseLines(buffer: Buffer, baseOffset: number): ConversationItem[] {
  const items: ConversationItem[] = [];
  let start = 0;
  while (start <= buffer.length) {
    const newline = buffer.indexOf(NEWLINE, start);
    const end = newline === -1 ? buffer.length : newline;
    const lineOffset = baseOffset + start;
    const line = buffer.subarray(start, end).toString('utf8');
    start = end + 1;
    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    items.push(...itemsOf(entry, lineOffset));
  }
  return items;
}

function parseEntries(buffer: Buffer): Record<string, unknown>[] {
  const entries: Record<string, unknown>[] = [];
  for (const line of buffer.toString('utf8').split('\n')) {
    try {
      const entry: unknown = JSON.parse(line);
      if (isBlock(entry) && !Array.isArray(entry)) entries.push(entry);
    } catch {
      continue;
    }
  }
  return entries;
}

async function readToLineEnd(handle: FileHandle, position: number): Promise<Buffer | undefined> {
  const chunks: Buffer[] = [];
  for (;;) {
    const chunk = Buffer.alloc(LINE_CHUNK_BYTES);
    const { bytesRead } = await handle.read(chunk, 0, chunk.length, position);
    if (bytesRead === 0) return undefined;
    const newline = chunk.subarray(0, bytesRead).indexOf(NEWLINE);
    if (newline !== -1) {
      chunks.push(chunk.subarray(0, newline + 1));
      return Buffer.concat(chunks);
    }
    chunks.push(chunk.subarray(0, bytesRead));
    position += bytesRead;
  }
}

async function readLineAt(handle: FileHandle, offset: number): Promise<string | undefined> {
  if (offset > 0) {
    const previous = Buffer.alloc(1);
    const { bytesRead } = await handle.read(previous, 0, 1, offset - 1);
    if (bytesRead !== 1 || previous[0] !== NEWLINE) return undefined;
  }
  const chunks: Buffer[] = [];
  let position = offset;
  for (;;) {
    const chunk = Buffer.alloc(LINE_CHUNK_BYTES);
    const { bytesRead } = await handle.read(chunk, 0, chunk.length, position);
    if (bytesRead === 0) return undefined;
    const newline = chunk.subarray(0, bytesRead).indexOf(NEWLINE);
    if (newline !== -1) {
      chunks.push(chunk.subarray(0, newline));
      return Buffer.concat(chunks).toString('utf8');
    }
    chunks.push(chunk.subarray(0, bytesRead));
    position += bytesRead;
  }
}

const isFile = (file: string) => stat(file).then((stats) => stats.isFile(), () => false);

export class TranscriptReader {
  readonly #projectsDir: string;

  constructor(options: TranscriptReaderOptions = {}) {
    this.#projectsDir = path.join(options.claudeDir ?? defaultClaudeDir(), 'projects');
  }

  async locate(cwd: string, sessionId: string): Promise<string | undefined> {
    if (!SESSION_ID_PATTERN.test(sessionId)) return undefined;
    const fileName = `${sessionId}.jsonl`;
    const expected = path.join(this.#projectsDir, cwd.replace(/[^A-Za-z0-9]/g, '-'), fileName);
    if (await isFile(expected)) return expected;
    const projects = await readdir(this.#projectsDir, { withFileTypes: true }).catch(() => []);
    for (const project of projects) {
      if (!project.isDirectory()) continue;
      const candidate = path.join(this.#projectsDir, project.name, fileName);
      if (await isFile(candidate)) return candidate;
    }
    return undefined;
  }

  async readFrom(file: string, offset: number): Promise<{ items: ConversationItem[]; offset: number }> {
    let handle;
    try {
      handle = await open(file, 'r');
      const { size } = await handle.stat();
      if (size <= offset) return { items: [], offset };
      const buffer = Buffer.alloc(size - offset);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
      const lastNewline = buffer.subarray(0, bytesRead).lastIndexOf(NEWLINE);
      if (lastNewline === -1) return { items: [], offset };
      return {
        items: parseLines(buffer.subarray(0, lastNewline), offset),
        offset: offset + lastNewline + 1,
      };
    } catch {
      return { items: [], offset };
    } finally {
      await handle?.close().catch(() => {});
    }
  }

  async readEntriesFrom(
    file: string,
    offset: number,
    maxBytes = Infinity,
  ): Promise<{ entries: Record<string, unknown>[]; offset: number; more: boolean }> {
    let handle;
    try {
      handle = await open(file, 'r');
      const { size } = await handle.stat();
      if (size <= offset) return { entries: [], offset, more: false };
      const buffer = Buffer.alloc(Math.min(size - offset, Math.max(1, maxBytes)));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
      let lines = buffer.subarray(0, bytesRead);
      let lastNewline = lines.lastIndexOf(NEWLINE);
      if (lastNewline === -1 && offset + bytesRead < size) {
        // A line longer than maxBytes is read whole, or reading would never move past it.
        const rest = await readToLineEnd(handle, offset + bytesRead);
        if (rest) {
          lines = Buffer.concat([lines, rest]);
          lastNewline = lines.length - 1;
        }
      }
      if (lastNewline === -1) return { entries: [], offset, more: false };
      const next = offset + lastNewline + 1;
      return { entries: parseEntries(lines.subarray(0, lastNewline)), offset: next, more: offset + lines.length < size };
    } catch {
      return { entries: [], offset, more: false };
    } finally {
      await handle?.close().catch(() => {});
    }
  }

  async readItem(file: string, ref: ItemRef): Promise<string | undefined> {
    const valid = [ref.offset, ref.block].every((value) => Number.isSafeInteger(value) && value >= 0);
    if (!valid) return undefined;
    let handle;
    try {
      handle = await open(file, 'r');
      const line = await readLineAt(handle, ref.offset);
      return line === undefined ? undefined : fullContentOf(JSON.parse(line), ref.block);
    } catch {
      return undefined;
    } finally {
      await handle?.close().catch(() => {});
    }
  }
}
