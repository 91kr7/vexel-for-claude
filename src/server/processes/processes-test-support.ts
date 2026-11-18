// Builds ProcessFacts for the processes tests. Not imported by application code.
import type { ProcessFacts } from './process-reader.js';

export const APP = 'ai-client';
export const APP_DIR = '/home/me/ai-client';
export const FAKE = '/home/me/ai-client/test-support/fake-claude.mjs';

export function fact(pid: number, overrides: Partial<ProcessFacts> = {}): ProcessFacts {
  return {
    pid,
    ppid: 1,
    startTicks: String(pid * 100),
    startedAt: 1_700_000_000_000 + pid,
    argv: ['/bin/sleep', '100'],
    markers: { testServer: false },
    ...overrides,
  };
}

/** A Node process that runs the app's server from the app folder. */
export const server = (pid: number, overrides: Partial<ProcessFacts> = {}) =>
  fact(pid, { argv: ['/usr/bin/node', '--import', 'tsx', 'src/server/main.ts'], cwd: APP_DIR, cwdPackageName: APP, ...overrides });

export const fakeClaude = (pid: number, ppid: number, overrides: Partial<ProcessFacts> = {}) =>
  fact(pid, { ppid, argv: ['node', FAKE], cwd: '/home/me/project', markers: { testServer: false, sessionId: `s-${pid}` }, ...overrides });

export const claude = (pid: number, ppid: number, sessionId: string | undefined, overrides: Partial<ProcessFacts> = {}) =>
  fact(pid, { ppid, argv: ['claude'], cwd: '/home/me/project', markers: { testServer: false, sessionId }, ...overrides });
