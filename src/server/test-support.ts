// Shared helpers for the server tests. Not imported by application code.
import { mkdtemp, writeFile, chmod, mkdir, readdir, readFile, stat, utimes } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import xtermHeadless from '@xterm/headless';
import WebSocket from 'ws';

export const FAKE_CLI = fileURLToPath(new URL('../../test-support/fake-claude.mjs', import.meta.url));

export function hex(text: string): string {
  return Buffer.from(text, 'utf8').toString('hex');
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitFor(check: () => boolean, label: string, timeoutMs = 8000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for: ${label}`);
    await delay(20);
  }
}

export function tempDir(prefix = 'ai-client-test-'): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

/** Writes an executable wrapper that runs the fake CLI with FAKE_CLI_MARK set to `mark`. */
export async function writeFakeCliWrapper(dir: string, name: string, mark: string): Promise<string> {
  const file = path.join(dir, name);
  await writeFile(file, `#!/bin/sh\nFAKE_CLI_MARK=${mark} exec node ${FAKE_CLI} "$@"\n`);
  await chmod(file, 0o755);
  return file;
}

export class RecordingViewer {
  readonly frames: string[] = [];
  ended = 0;

  send(data: string): void {
    this.frames.push(data);
  }

  end(): void {
    this.ended += 1;
  }

  get text(): string {
    return this.frames.join('');
  }
}

/** Replays terminal output into a fresh headless terminal and returns its non-empty lines. */
export async function renderLines(output: string, cols = 120, rows = 30): Promise<string[]> {
  const terminal = new xtermHeadless.Terminal({ cols, rows, scrollback: 50_000, allowProposedApi: true });
  await new Promise<void>((resolve) => terminal.write(output, resolve));
  const lines: string[] = [];
  const buffer = terminal.buffer.active;
  for (let i = 0; i < buffer.length; i += 1) {
    const text = buffer.getLine(i)?.translateToString(true) ?? '';
    if (text !== '') lines.push(text);
  }
  terminal.dispose();
  return lines;
}

export interface WsClient {
  socket: WebSocket;
  frames: string[];
  text(): string;
  closeCode: number | undefined;
  closed: Promise<number>;
  send(message: unknown): void;
}

export function connectWs(url: string, headers: Record<string, string> = {}): WsClient {
  const socket = new WebSocket(url, { headers });
  const client: WsClient = {
    socket,
    frames: [],
    text: () => client.frames.join(''),
    closeCode: undefined,
    closed: new Promise<number>((resolve) => {
      socket.on('close', (code) => {
        client.closeCode = code;
        resolve(code);
      });
    }),
    send: (message) => {
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      if (socket.readyState === WebSocket.OPEN) socket.send(payload);
      else socket.once('open', () => socket.send(payload));
    },
  };
  socket.on('message', (data) => client.frames.push(data.toString()));
  socket.on('error', () => {});
  return client;
}

/** Writes an executable CLI stand-in that prints READY, and GOT-SIGTERM on each SIGTERM; `exit` ends it there, `ignore` keeps it alive. */
export async function writeSigtermScript(dir: string, name: string, onSigterm: 'exit' | 'ignore'): Promise<string> {
  const file = path.join(dir, name);
  const handler = onSigterm === 'exit' ? 'process.exit(0);' : '';
  await writeFile(
    file,
    `#!/usr/bin/env node\nprocess.on('SIGTERM', () => { process.stdout.write('GOT-SIGTERM\\r\\n'); ${handler} });\nprocess.stdout.write('READY\\r\\n');\nsetInterval(() => {}, 1000);\n`,
  );
  await chmod(file, 0o755);
  return file;
}

/** Writes `<claudeDir>/projects/<project>/<id>.jsonl` with one JSON line per entry (strings are written as is). */
export async function writeHistorySession(
  claudeDir: string,
  project: string,
  id: string,
  entries: (object | string)[],
  modified?: Date,
): Promise<string> {
  const dir = path.join(claudeDir, 'projects', project);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${id}.jsonl`);
  await writeFile(file, entries.map((entry) => (typeof entry === 'string' ? entry : JSON.stringify(entry))).join('\n') + '\n');
  if (modified) await utimes(file, modified, modified);
  return file;
}

export const userEntry = (content: unknown, cwd?: string, extra: object = {}) => ({
  type: 'user',
  ...(cwd === undefined ? {} : { cwd }),
  message: { role: 'user', content },
  ...extra,
});

/** Path, content and modification time of every file under `dir`, to prove nothing changed. */
export async function snapshotTree(dir: string): Promise<Record<string, { content: string; mtimeMs: number }>> {
  const result: Record<string, { content: string; mtimeMs: number }> = {};
  const walk = async (current: string): Promise<void> => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        result[`${path.relative(dir, full)}/`] = { content: '', mtimeMs: (await stat(full)).mtimeMs };
        await walk(full);
      } else if (entry.isFile()) {
        result[path.relative(dir, full)] = { content: await readFile(full, 'utf8'), mtimeMs: (await stat(full)).mtimeMs };
      }
    }
  };
  await walk(dir);
  return result;
}
