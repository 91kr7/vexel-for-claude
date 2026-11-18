import { type ChildProcess, spawn } from 'node:child_process';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FAKE_CLI, waitFor } from '../test-support.js';
import { ProcessReader } from './process-reader.js';
import { type TerminateResult, ProcessTerminator } from './process-terminator.js';
import { registerTerminateProcessRoute } from './terminate-process-route.js';

// REQ tests at the REST API of plan-app_processes, batch terminate-process.
// The real terminator only ever targets processes this file starts, stopped by their PID.
const apps: FastifyInstance[] = [];
const children: ChildProcess[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
  for (const child of children.splice(0)) if (child.pid !== undefined && isAlive(child.pid)) process.kill(child.pid, 'SIGKILL');
});

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function routeWith(terminate: (pid: number, startedAt: number) => Promise<TerminateResult>): Promise<FastifyInstance> {
  const app = Fastify();
  registerTerminateProcessRoute(app, { terminate });
  await app.ready();
  apps.push(app);
  return app;
}

const post = (app: FastifyInstance, payload: unknown) =>
  app.inject({ method: 'POST', url: '/api/processes/terminate', payload: payload as object });

describe('POST /api/processes/terminate with a fake terminator', () => {
  it.each(['ended', 'gone', 'running', 'not_allowed'] as const)('answers 200 with the outcome "%s"', async (outcome) => {
    const terminate = vi.fn(async () => ({ outcome }));
    const response = await post(await routeWith(terminate), { pid: 42, startedAt: 1_700_000_000_123 });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ outcome });
    expect(terminate).toHaveBeenCalledWith(42, 1_700_000_000_123);
  });

  it.each([
    ['no pid', { startedAt: 1000 }],
    ['a pid as text', { pid: '42', startedAt: 1000 }],
    ['pid 0', { pid: 0, startedAt: 1000 }],
    ['a negative pid', { pid: -42, startedAt: 1000 }],
    ['a fractional pid', { pid: 4.2, startedAt: 1000 }],
    ['no startedAt', { pid: 42 }],
    ['a startedAt as text', { pid: 42, startedAt: '1000' }],
    ['an array', [42, 1000]],
  ])('answers 400 "invalid_body" for %s and terminates nothing', async (_, payload) => {
    const terminate = vi.fn(async () => ({ outcome: 'ended' as const }));
    const response = await post(await routeWith(terminate), payload);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_body' });
    expect(terminate).not.toHaveBeenCalled();
  });

  // plan-app_processes/REQ-23: the current instance answers first, then signals itself
  it('runs afterAnswer once, after the answer "ended" is sent', async () => {
    let answered = false;
    const afterAnswer = vi.fn(() => answered);
    const app = await routeWith(async () => ({ outcome: 'ended', afterAnswer }));
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const response = await fetch(`${address}/api/processes/terminate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pid: 42, startedAt: 1000 }),
    });
    expect(await response.json()).toEqual({ outcome: 'ended' });
    answered = true;
    await waitFor(() => afterAnswer.mock.calls.length > 0, 'afterAnswer runs');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(afterAnswer).toHaveBeenCalledTimes(1);
  });
});

/** A Node process that the classifier lists as a fake Claude: its arguments name the fake CLI. */
function startFakeClaude(code: string): ChildProcess {
  const child = spawn(process.execPath, ['-e', code, FAKE_CLI], { stdio: ['ignore', 'pipe', 'ignore'] });
  children.push(child);
  return child;
}

/** The start time of a pid as ProcessReader gives it, once its arguments include `arg` (the exec is done). */
async function listedStartedAt(pid: number, arg = FAKE_CLI): Promise<number> {
  const reader = new ProcessReader();
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const facts = (await reader.readProcesses()).find((entry) => entry.pid === pid && entry.argv.includes(arg));
    if (facts) return facts.startedAt;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`pid ${pid} is not listed`);
}

/** The route on the real ProcessReader and ProcessTerminator. `ownPid` defaults to a PID no test process has. */
async function realRoute(options: { ownPid?: number; endTimeoutMs?: number; signal?: (pid: number, name: NodeJS.Signals) => void } = {}) {
  const app = Fastify();
  registerTerminateProcessRoute(
    app,
    new ProcessTerminator({
      reader: new ProcessReader(),
      registry: { list: () => [] },
      ownPid: options.ownPid ?? 2 ** 22 + 1,
      appName: 'ai-client',
      endTimeoutMs: options.endTimeoutMs,
      signal: options.signal,
    }),
  );
  await app.ready();
  apps.push(app);
  return app;
}

const IDLE = 'setInterval(() => {}, 1000)';

describe('POST /api/processes/terminate on real processes', () => {
  // plan-app_processes/REQ-29, REQ-31: the process ends, its child keeps running
  it('ends the chosen process and not its child process', async () => {
    const parent = startFakeClaude(
      `const c = require('node:child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' }); console.log(c.pid); ${IDLE}`,
    );
    let output = '';
    parent.stdout?.on('data', (data) => (output += String(data)));
    await waitFor(() => /\d+\n/.test(output), 'the child pid is printed');
    const childPid = Number(output.trim());
    children.push({ pid: childPid, exitCode: null } as ChildProcess);
    const pid = parent.pid as number;
    const startedAt = await listedStartedAt(pid);

    const response = await post(await realRoute(), { pid, startedAt });

    expect(response.json()).toEqual({ outcome: 'ended' });
    await waitFor(() => parent.signalCode !== null, 'the parent exits');
    expect(parent.signalCode).toBe('SIGTERM');
    expect(isAlive(childPid)).toBe(true);
  });

  // plan-app_processes/REQ-30: a PID with another start time is never signalled
  it('answers "gone" and leaves the process running when the start time differs', async () => {
    const child = startFakeClaude(IDLE);
    const pid = child.pid as number;
    const startedAt = await listedStartedAt(pid);
    const response = await post(await realRoute(), { pid, startedAt: startedAt - 10_000 });
    expect(response.json()).toEqual({ outcome: 'gone' });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(isAlive(pid)).toBe(true);
    expect(child.signalCode).toBeNull();
  });

  // plan-app_processes/REQ-30: a process that is not of the app is never signalled
  it('answers "gone" for a process that is not of the app', async () => {
    const child = spawn(process.execPath, ['-e', IDLE], { stdio: 'ignore' });
    children.push(child);
    const pid = child.pid as number;
    const startedAt = await listedStartedAt(pid, IDLE);
    const response = await post(await realRoute(), { pid, startedAt });
    expect(response.json()).toEqual({ outcome: 'gone' });
    expect(isAlive(pid)).toBe(true);
  });

  // plan-app_processes/REQ-32: a process that ignores SIGTERM keeps running and the answer says so
  it('answers "running" when the process ignores SIGTERM', async () => {
    const child = startFakeClaude(`process.on('SIGTERM', () => {}); console.log('ready'); ${IDLE}`);
    // The process is listed as soon as it execs, before Node runs its code: wait until the handler is installed.
    let output = '';
    child.stdout?.on('data', (data) => (output += String(data)));
    await waitFor(() => output.includes('ready'), 'the SIGTERM handler is installed');
    const pid = child.pid as number;
    const startedAt = await listedStartedAt(pid);
    const response = await post(await realRoute({ endTimeoutMs: 500 }), { pid, startedAt });
    expect(response.json()).toEqual({ outcome: 'running' });
    expect(isAlive(pid)).toBe(true);
  });

  // plan-app_processes/REQ-23: the current instance gets its SIGTERM only after the answer
  it('answers "ended" for the current instance and signals it only after the answer', async () => {
    const own = startFakeClaude(IDLE);
    const pid = own.pid as number;
    const startedAt = await listedStartedAt(pid);
    const signals: Array<[number, NodeJS.Signals]> = [];
    const app = await realRoute({ ownPid: pid, signal: (target, name) => void signals.push([target, name]) });
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const response = await fetch(`${address}/api/processes/terminate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pid, startedAt }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: 'ended' });
    await waitFor(() => signals.length > 0, 'the self SIGTERM');
    expect(signals).toEqual([[pid, 'SIGTERM']]);
  });
});
