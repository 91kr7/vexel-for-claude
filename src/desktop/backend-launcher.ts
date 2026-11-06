import { spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const HOST = '127.0.0.1';
const DEFAULT_PORT = 4001;
const DEFAULT_READY_TIMEOUT_MS = 15_000;
const HEALTH_TIMEOUT_MS = 1_000;
const POLL_INTERVAL_MS = 100;
const OUTPUT_LINE_COUNT = 20;

export interface LaunchOptions {
  rootDir: string;
  logFile: string;
  port?: number;
  nodePath?: string;
  command?: readonly string[];
  readyTimeoutMs?: number;
}

export type LaunchResult =
  | { status: 'ready'; origin: string; startedByApp: boolean }
  | { status: 'failed'; outputLines: string[] };

export function backendPort(env: NodeJS.ProcessEnv): number {
  return env.PORT ? Number(env.PORT) : DEFAULT_PORT;
}

export function backendOrigin(port: number): string {
  return `http://${HOST}:${port}`;
}

export async function isBackendRunning(origin: string): Promise<boolean> {
  try {
    const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    if (response.status !== 200) return false;
    const body: unknown = await response.json();
    return typeof body === 'object' && body !== null && (body as { status?: unknown }).status === 'ok';
  } catch {
    return false;
  }
}

function lastOutputLines(logFile: string): string[] {
  try {
    const lines = readFileSync(logFile, 'utf8').split('\n').filter((line) => line.trim() !== '');
    return lines.slice(-OUTPUT_LINE_COUNT);
  } catch {
    return [];
  }
}

export async function launchBackend(options: LaunchOptions): Promise<LaunchResult> {
  const port = options.port ?? backendPort(process.env);
  const origin = backendOrigin(port);
  if (await isBackendRunning(origin)) return { status: 'ready', origin, startedByApp: false };

  const nodePath = options.nodePath ?? (process.env.AI_CLIENT_NODE || 'node');
  const [file, ...args] = options.command ?? [nodePath, '--import', 'tsx', 'src/server/main.ts'];
  if (file === undefined) throw new Error('launchBackend: empty command');
  const readyTimeoutMs = options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS;

  mkdirSync(path.dirname(options.logFile), { recursive: true });
  const output = openSync(options.logFile, 'w');
  const child = spawn(file, args, {
    cwd: options.rootDir,
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port) },
    detached: true,
    stdio: ['ignore', output, output],
  });
  closeSync(output);
  child.unref();

  return new Promise<LaunchResult>((resolve) => {
    let settled = false;
    const fail = (reason: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ status: 'failed', outputLines: [...lastOutputLines(options.logFile), reason] });
    };
    const timer = setTimeout(() => {
      child.kill();
      fail(`Backend not ready within ${readyTimeoutMs / 1000} seconds.`);
    }, readyTimeoutMs);

    child.once('error', (error) => fail(error.message));
    child.once('exit', (code, signal) =>
      fail(code === null ? `Backend exited with signal ${signal}.` : `Backend exited with code ${code}.`),
    );

    void (async () => {
      while (!settled) {
        if (await isBackendRunning(origin)) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({ status: 'ready', origin, startedByApp: true });
          return;
        }
        await delay(POLL_INTERVAL_MS);
      }
    })();
  });
}
