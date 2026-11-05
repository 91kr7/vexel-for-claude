import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';

export interface PastSession {
  id: string;
  folder: string | null;
  firstUserMessage: string | null;
  lastModified: Date;
}

export interface SessionHistoryOptions {
  claudeDir?: string;
}

const SESSION_FILE_SUFFIX = '.jsonl';
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const COMMAND_NAME_PATTERN = /<command-name>([\s\S]*?)<\/command-name>/;
const COMMAND_ARGS_PATTERN = /<command-args>([\s\S]*?)<\/command-args>/;
const READ_CONCURRENCY = 16;

export function defaultClaudeDir(): string {
  return process.env.CLAUDE_CONFIG_DIR || path.join(homedir(), '.claude');
}

function textOf(content: unknown): string | undefined {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return undefined;
  const block = content.find(
    (item): item is { type: 'text'; text: string } =>
      typeof item === 'object' && item !== null && item.type === 'text' && typeof item.text === 'string',
  );
  return block?.text;
}

function userMessageOf(entry: Record<string, unknown>): string | null {
  if (entry.type !== 'user' || entry.isMeta === true || entry.isSidechain === true) return null;
  const message = entry.message as { content?: unknown } | undefined;
  const text = textOf(message?.content);
  if (text === undefined) return null;
  const command = COMMAND_NAME_PATTERN.exec(text);
  if (command) {
    const args = COMMAND_ARGS_PATTERN.exec(text)?.[1]?.trim() ?? '';
    return args === '' ? null : `${command[1]?.trim() ?? ''} ${args}`;
  }
  if (text.trimStart().startsWith('<local-command-')) return null;
  return text.trim() || null;
}

async function readSessionFile(file: string, id: string): Promise<PastSession | undefined> {
  let lastModified: Date;
  try {
    const stats = await stat(file);
    if (!stats.isFile()) return undefined;
    lastModified = stats.mtime;
  } catch {
    return undefined;
  }
  let folder: string | null = null;
  let firstUserMessage: string | null = null;
  const stream = createReadStream(file, { encoding: 'utf8', flags: 'r' });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      let entry: unknown;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      if (typeof entry !== 'object' || entry === null) continue;
      const record = entry as Record<string, unknown>;
      if (folder === null && typeof record.cwd === 'string' && record.cwd !== '') folder = record.cwd;
      firstUserMessage ??= userMessageOf(record);
      if (folder !== null && firstUserMessage !== null) break;
    }
  } catch {
    return undefined;
  } finally {
    lines.close();
    stream.destroy();
  }
  return { id, folder, firstUserMessage, lastModified };
}

async function mapLimited<T, R>(items: T[], limit: number, map: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await map(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export class SessionHistory {
  readonly #projectsDir: string;

  constructor(options: SessionHistoryOptions = {}) {
    this.#projectsDir = path.join(options.claudeDir ?? defaultClaudeDir(), 'projects');
  }

  async list(): Promise<PastSession[]> {
    const files: { file: string; id: string }[] = [];
    for (const project of await this.#projectFolders()) {
      const entries = await readdir(project, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(SESSION_FILE_SUFFIX)) continue;
        files.push({ file: path.join(project, entry.name), id: entry.name.slice(0, -SESSION_FILE_SUFFIX.length) });
      }
    }
    const sessions = await mapLimited(files, READ_CONCURRENCY, ({ file, id }) => readSessionFile(file, id));
    return sessions
      .filter((session): session is PastSession => session !== undefined)
      .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  }

  async get(sessionId: string): Promise<PastSession | undefined> {
    if (!SESSION_ID_PATTERN.test(sessionId)) return undefined;
    for (const project of await this.#projectFolders()) {
      const session = await readSessionFile(path.join(project, `${sessionId}${SESSION_FILE_SUFFIX}`), sessionId);
      if (session) return session;
    }
    return undefined;
  }

  async #projectFolders(): Promise<string[]> {
    const entries = await readdir(this.#projectsDir, { withFileTypes: true }).catch(() => []);
    return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(this.#projectsDir, entry.name));
  }
}
