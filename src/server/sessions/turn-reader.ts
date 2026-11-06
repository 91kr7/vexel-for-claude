import { open } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { type ConversationItem, itemsOf, TranscriptReader } from '../external/transcript-reader.js';

export interface LastTurn {
  interrupted: boolean;
  finalResponse?: string;
}

export interface TurnReaderOptions {
  transcripts?: Pick<TranscriptReader, 'locate'>;
  retryMs?: number;
}

const DEFAULT_RETRY_MS = 1000;
const TAIL_BYTES = 128 * 1024;
const INTERRUPT_MARKER = '[Request interrupted by user';

async function tailLines(file: string): Promise<ConversationItem[][]> {
  let handle;
  try {
    handle = await open(file, 'r');
    const { size } = await handle.stat();
    const start = Math.max(0, size - TAIL_BYTES);
    const buffer = Buffer.alloc(size - start);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
    const lines = buffer.subarray(0, bytesRead).toString('utf8').split('\n');
    lines.pop();
    if (start > 0) lines.shift();
    return lines.flatMap((line) => {
      try {
        const items = itemsOf(JSON.parse(line));
        return items.length > 0 ? [items] : [];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  } finally {
    await handle?.close().catch(() => {});
  }
}

function interrupted(lines: ConversationItem[][]): boolean {
  return lines.at(-1)?.some((item) => item.kind === 'user' && item.text.startsWith(INTERRUPT_MARKER)) ?? false;
}

const endsOnReply = (lines: ConversationItem[][]) => lines.at(-1)?.at(-1)?.kind === 'assistant';

function finalResponseOf(items: ConversationItem[]): string {
  const start = items.findLastIndex((item) => item.kind === 'user' || item.kind === 'tool_result') + 1;
  return items
    .slice(start)
    .flatMap((item) => (item.kind === 'assistant' ? [item.text] : []))
    .join('\n');
}

export class TurnReader {
  readonly #transcripts: Pick<TranscriptReader, 'locate'>;
  readonly #retryMs: number;

  constructor(options: TurnReaderOptions = {}) {
    this.#transcripts = options.transcripts ?? new TranscriptReader();
    this.#retryMs = options.retryMs ?? DEFAULT_RETRY_MS;
  }

  async lastTurn(folder: string, claudeSessionId: string): Promise<LastTurn> {
    let lines = await this.#read(folder, claudeSessionId);
    if (!interrupted(lines) && !endsOnReply(lines)) {
      await delay(this.#retryMs);
      lines = await this.#read(folder, claudeSessionId);
    }
    if (interrupted(lines)) return { interrupted: true };
    if (!endsOnReply(lines)) return { interrupted: false };
    return { interrupted: false, finalResponse: finalResponseOf(lines.flat()) };
  }

  async #read(folder: string, claudeSessionId: string): Promise<ConversationItem[][]> {
    const file = await this.#transcripts.locate(folder, claudeSessionId).catch(() => undefined);
    return file === undefined ? [] : tailLines(file);
  }
}
