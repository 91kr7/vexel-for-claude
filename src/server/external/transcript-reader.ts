import { open, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { defaultClaudeDir, userMessageOf } from '../history/session-history.js';

export type ConversationItem =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool_call'; name: string; summary: string }
  | { kind: 'tool_result'; text: string; truncated: boolean };

export interface TranscriptReaderOptions {
  claudeDir?: string;
}

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const RESULT_LINES = 5;
const SUMMARY_LENGTH = 120;
const SUMMARY_KEYS = ['command', 'file_path', 'path', 'pattern', 'url', 'query', 'description', 'prompt'];
const NEWLINE = 0x0a;

type Block = Record<string, unknown>;

function blocksOf(content: unknown): Block[] {
  return Array.isArray(content) ? content.filter((block): block is Block => typeof block === 'object' && block !== null) : [];
}

function toolResultItem(block: Block): ConversationItem {
  const text =
    typeof block.content === 'string'
      ? block.content
      : blocksOf(block.content)
          .filter((part) => part.type === 'text' && typeof part.text === 'string')
          .map((part) => part.text as string)
          .join('\n');
  const lines = text.trimEnd().split('\n');
  return { kind: 'tool_result', text: lines.slice(0, RESULT_LINES).join('\n'), truncated: lines.length > RESULT_LINES };
}

function summaryOf(input: unknown): string {
  let value = '';
  if (typeof input === 'object' && input !== null) {
    const record = input as Record<string, unknown>;
    const preferred = SUMMARY_KEYS.map((key) => record[key]).find((item) => typeof item === 'string');
    const anyString = Object.values(record).find((item) => typeof item === 'string');
    value = (preferred ?? anyString ?? JSON.stringify(input)) as string;
  } else if (input !== undefined) {
    value = JSON.stringify(input);
  }
  const line = Array.from(value.replace(/\s+/g, ' ').trim());
  return line.length > SUMMARY_LENGTH ? `${line.slice(0, SUMMARY_LENGTH).join('')}…` : line.join('');
}

function assistantItems(content: unknown): ConversationItem[] {
  if (typeof content === 'string') return content.trim() ? [{ kind: 'assistant', text: content.trim() }] : [];
  const items: ConversationItem[] = [];
  for (const block of blocksOf(content)) {
    if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
      items.push({ kind: 'assistant', text: block.text.trim() });
    } else if (block.type === 'tool_use') {
      items.push({ kind: 'tool_call', name: typeof block.name === 'string' ? block.name : '', summary: summaryOf(block.input) });
    }
  }
  return items;
}

export function itemsOf(entry: unknown): ConversationItem[] {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return [];
  const record = entry as Record<string, unknown>;
  if (record.isSidechain === true || record.isMeta === true) return [];
  const content = (record.message as { content?: unknown } | undefined)?.content;
  if (record.type === 'assistant') return assistantItems(content);
  if (record.type !== 'user') return [];
  const items: ConversationItem[] = [];
  const text = userMessageOf(record);
  if (text !== null) items.push({ kind: 'user', text });
  for (const block of blocksOf(content)) {
    if (block.type === 'tool_result') items.push(toolResultItem(block));
  }
  return items;
}

function parseLines(text: string): ConversationItem[] {
  const items: ConversationItem[] = [];
  for (const line of text.split('\n')) {
    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    items.push(...itemsOf(entry));
  }
  return items;
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
        items: parseLines(buffer.subarray(0, lastNewline).toString('utf8')),
        offset: offset + lastNewline + 1,
      };
    } catch {
      return { items: [], offset };
    } finally {
      await handle?.close().catch(() => {});
    }
  }
}
