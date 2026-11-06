import { chmod, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  FAKE_CLI,
  RecordingViewer,
  delay,
  hex,
  renderLines,
  tempDir,
  waitFor,
  writeFakeCliWrapper,
  writeSigtermScript,
} from '../test-support.js';
import { type Session, SessionRegistry } from './session-registry.js';

const started: Session[] = [];
let workDir: string;

function startFake(registry = new SessionRegistry({ command: FAKE_CLI }), cwd = workDir): Session {
  const session = registry.start(cwd);
  started.push(session);
  return session;
}

/** Attaches a viewer and waits until the fake CLI has printed its start banner. */
async function attachReady(session: Session): Promise<RecordingViewer> {
  const viewer = new RecordingViewer();
  session.attach(viewer);
  await waitFor(() => viewer.text.includes('READY'), 'fake CLI banner');
  return viewer;
}

function receivedInput(text: string): string[] {
  return [...text.matchAll(/IN:([0-9a-f]+)/g)].map((match) => match[1] ?? '');
}

const endReport = (session: Session) => ({ exitCode: session.exitCode, signal: session.signal, stopRequested: session.stopRequested });

beforeAll(async () => {
  workDir = await tempDir();
});

afterAll(async () => {
  for (const session of started) session.write('/exit\r');
  await delay(200);
});

describe('SessionRegistry command', () => {
  const savedEnv = { cli: process.env.AI_CLIENT_CLAUDE_CLI, path: process.env.PATH };
  let binDir: string;
  let customCli: string;

  beforeAll(async () => {
    binDir = await tempDir('ai-client-bin-');
    await writeFakeCliWrapper(binDir, 'claude', 'default-claude');
    customCli = await writeFakeCliWrapper(binDir, 'custom-cli', 'custom');
    process.env.PATH = `${binDir}:${savedEnv.path ?? ''}`;
  });

  afterEach(() => {
    if (savedEnv.cli === undefined) delete process.env.AI_CLIENT_CLAUDE_CLI;
    else process.env.AI_CLIENT_CLAUDE_CLI = savedEnv.cli;
  });

  afterAll(() => {
    process.env.PATH = savedEnv.path;
  });

  it('uses AI_CLIENT_CLAUDE_CLI when it is set', async () => {
    process.env.AI_CLIENT_CLAUDE_CLI = customCli;
    const viewer = await attachReady(startFake(new SessionRegistry()));
    expect(viewer.text).toContain('MARK:custom');
  });

  it('uses `claude` when AI_CLIENT_CLAUDE_CLI is not set', async () => {
    delete process.env.AI_CLIENT_CLAUDE_CLI;
    const viewer = await attachReady(startFake(new SessionRegistry()));
    expect(viewer.text).toContain('MARK:default-claude');
  });

  it('uses `claude` when AI_CLIENT_CLAUDE_CLI is empty', async () => {
    process.env.AI_CLIENT_CLAUDE_CLI = '';
    const viewer = await attachReady(startFake(new SessionRegistry()));
    expect(viewer.text).toContain('MARK:default-claude');
  });

  it('options.command wins over the environment variable', async () => {
    delete process.env.AI_CLIENT_CLAUDE_CLI;
    const viewer = await attachReady(startFake(new SessionRegistry({ command: customCli })));
    expect(viewer.text).toContain('MARK:custom');
  });
});

describe('SessionRegistry.start', () => {
  it('spawns the CLI in the given folder, with no arguments, at 120x30', async () => {
    const viewer = await attachReady(startFake());
    expect(viewer.text).toContain(`CWD:${workDir}`);
    expect(viewer.text).toContain('ARGS:[]');
    expect(viewer.text).toContain('SIZE:120x30');
  });

  it('passes the server environment plus TERM and COLORTERM', async () => {
    const saved = { term: process.env.TERM, color: process.env.COLORTERM, mark: process.env.FAKE_CLI_MARK };
    process.env.TERM = 'dumb';
    process.env.COLORTERM = '';
    process.env.FAKE_CLI_MARK = 'server-env';
    try {
      const viewer = await attachReady(startFake());
      expect(viewer.text).toContain('TERM:xterm-256color');
      expect(viewer.text).toContain('COLORTERM:truecolor');
      expect(viewer.text).toContain('MARK:server-env');
    } finally {
      process.env.TERM = saved.term;
      process.env.COLORTERM = saved.color;
      if (saved.mark === undefined) delete process.env.FAKE_CLI_MARK;
      else process.env.FAKE_CLI_MARK = saved.mark;
    }
  });

  it('gives each session a new UUID and keeps it by id', () => {
    const registry = new SessionRegistry({ command: FAKE_CLI });
    const a = startFake(registry);
    const b = startFake(registry);
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(a.id).toMatch(uuid);
    expect(b.id).toMatch(uuid);
    expect(a.id).not.toBe(b.id);
    expect(registry.get(a.id)).toBe(a);
    expect(registry.get(b.id)).toBe(b);
    expect(a.cwd).toBe(workDir);
  });

  it('get returns undefined for an unknown id', () => {
    expect(new SessionRegistry({ command: FAKE_CLI }).get('no-such-id')).toBeUndefined();
  });

  // plan-claude_sessions_client/REQ-14: the CLI starts with the hook settings file and nothing else
  it('passes only --settings <settingsPath> when settingsPath is set', async () => {
    const registry = new SessionRegistry({ command: FAKE_CLI, settingsPath: '/tmp/hooks dir/hook-settings.json' });
    const viewer = await attachReady(startFake(registry));
    expect(viewer.text).toContain('ARGS:["--settings","/tmp/hooks dir/hook-settings.json"]');
  });

  // plan-claude_sessions_client/REQ-14: each hook names its session through AI_CLIENT_SESSION_ID
  it('puts the session id in AI_CLIENT_SESSION_ID', async () => {
    const binDir = await tempDir('ai-client-bin-');
    const cli = path.join(binDir, 'session-id-cli');
    await writeFile(cli, `#!/bin/sh\nFAKE_CLI_MARK="$AI_CLIENT_SESSION_ID" exec node ${FAKE_CLI} "$@"\n`);
    await chmod(cli, 0o755);
    const session = startFake(new SessionRegistry({ command: cli }));
    const viewer = await attachReady(session);
    expect(viewer.text).toContain(`MARK:${session.id}`);
  });
});

describe('SessionRegistry resume, pid and list', () => {
  const startResumed = (registry: SessionRegistry, resume: { sessionId: string; firstUserMessage?: string | null }) => {
    const session = registry.start(workDir, resume);
    started.push(session);
    return session;
  };

  // plan-claude_sessions_client/REQ-25, REQ-26
  it('passes --resume <sessionId> after --settings, and nothing else', async () => {
    const registry = new SessionRegistry({ command: FAKE_CLI, settingsPath: '/tmp/hooks/hook-settings.json' });
    const viewer = await attachReady(startResumed(registry, { sessionId: 'past-123', firstUserMessage: 'Ciao' }));
    expect(viewer.text).toContain('ARGS:["--settings","/tmp/hooks/hook-settings.json","--resume","past-123"]');
    expect(viewer.text).toContain(`CWD:${workDir}`);
  });

  it('passes only --resume <sessionId> when settingsPath is not set', async () => {
    const viewer = await attachReady(startResumed(new SessionRegistry({ command: FAKE_CLI }), { sessionId: 'past-456' }));
    expect(viewer.text).toContain('ARGS:["--resume","past-456"]');
  });

  it('keeps the resume data in resumedFrom, undefined for a new session', () => {
    const registry = new SessionRegistry({ command: FAKE_CLI });
    const resume = { sessionId: 'past-789', firstUserMessage: 'Correggi il bug' };
    expect(startResumed(registry, resume).resumedFrom).toEqual(resume);
    expect(startFake(registry).resumedFrom).toBeUndefined();
  });

  it('gives the pid of the CLI process', async () => {
    const session = startFake();
    await attachReady(session);
    expect(session.pid).toBeGreaterThan(0);
    expect(() => process.kill(session.pid, 0)).not.toThrow();
    session.write('/exit\r');
    await waitFor(() => session.exited, 'process exit');
    await waitFor(() => {
      try {
        process.kill(session.pid, 0);
        return false;
      } catch {
        return true;
      }
    }, 'process gone');
  });

  it('list gives every session in start order, ended ones included', async () => {
    const registry = new SessionRegistry({ command: FAKE_CLI });
    const a = startFake(registry);
    const b = startResumed(registry, { sessionId: 'past-list' });
    const c = startFake(registry);
    await attachReady(b);
    b.write('/exit\r');
    await waitFor(() => b.exited, 'process exit');
    expect(registry.list()).toEqual([a, b, c]);
  });

  // plan-claude_sessions_client/REQ-29
  it('hostedPids gives the pid of every session whose process has not ended', async () => {
    const registry = new SessionRegistry({ command: FAKE_CLI });
    expect(registry.hostedPids()).toEqual([]);
    const a = startFake(registry);
    const b = startFake(registry);
    await attachReady(a);
    a.write('/exit\r');
    await waitFor(() => a.exited, 'process exit');
    expect(registry.hostedPids()).toEqual([b.pid]);
  });
});

describe('SessionRegistry.onSessionStart', () => {
  // plan-claude_sessions_client/REQ-14: listeners see each started session before start returns
  it('calls each listener with the session before start returns, until unsubscribed', () => {
    const registry = new SessionRegistry({ command: FAKE_CLI });
    const seen: Session[] = [];
    const unsubscribe = registry.onSessionStart((session) => {
      seen.push(session);
      expect(registry.get(session.id)).toBe(session);
    });
    const first = startFake(registry);
    expect(seen).toEqual([first]);
    unsubscribe();
    startFake(registry);
    expect(seen).toEqual([first]);
  });
});

describe('Session.onExit', () => {
  // plan-claude_sessions_client/REQ-14: process exit is reported once
  it('calls the listener once when the process ends; a listener added after the end is never called', async () => {
    const session = startFake();
    let calls = 0;
    let removedCalls = 0;
    session.onExit(() => (calls += 1));
    const unsubscribe = session.onExit(() => (removedCalls += 1));
    unsubscribe();
    await attachReady(session);
    session.write('/exit\r');
    await waitFor(() => session.exited, 'process exit');
    await delay(100);
    expect(calls).toBe(1);
    expect(removedCalls).toBe(0);
    let lateCalls = 0;
    session.onExit(() => (lateCalls += 1));
    await delay(100);
    expect(lateCalls).toBe(0);
  });
});

describe('Session input and size', () => {
  it('the registry writes nothing to the pty on its own', async () => {
    const session = startFake();
    const viewer = await attachReady(session);
    session.resize(100, 40);
    await waitFor(() => viewer.text.includes('WINCH:100x40'), 'resize');
    await delay(500);
    expect(receivedInput(viewer.text)).toEqual([]);
  });

  it('write sends the data unchanged, control characters and Esc included', async () => {
    const session = startFake();
    const viewer = await attachReady(session);
    const data = 'héllo\x1b\x03\t/help\r';
    session.write(data);
    await waitFor(() => viewer.text.includes('LINE:'), 'input echo');
    expect(receivedInput(viewer.text).join('')).toBe(hex(data));
  });

  it('resize resizes the pty', async () => {
    const session = startFake();
    const viewer = await attachReady(session);
    session.resize(90, 20);
    await waitFor(() => viewer.text.includes('WINCH:90x20'), 'pty resize');
  });

  it('resize also resizes the mirror', async () => {
    const session = startFake();
    const viewer = await attachReady(session);
    session.resize(50, 20);
    session.write(`${'y'.repeat(70)}\r`);
    await waitFor(() => viewer.text.includes(`LINE:${'y'.repeat(20)}`), 'echo');
    const late = new RecordingViewer();
    session.attach(late);
    await waitFor(() => late.frames.length > 0, 'snapshot');
    const lines = await renderLines(late.frames[0] ?? '', 50, 20);
    expect(lines, 'LINE: plus 70 characters wraps at 50 columns').toContain(`LINE:${'y'.repeat(45)}`);
  });

  it('exited becomes true when the process ends; write and resize then have no effect', async () => {
    const registry = new SessionRegistry({ command: FAKE_CLI });
    const session = startFake(registry);
    const viewer = await attachReady(session);
    expect(session.exited).toBe(false);
    session.write('/exit\r');
    await waitFor(() => session.exited, 'process exit');
    expect(() => session.write('more\r')).not.toThrow();
    expect(() => session.resize(80, 24)).not.toThrow();
    expect(registry.get(session.id)).toBe(session);
    expect(viewer.text).toContain('BYE');
  });
});

describe('Session.attach', () => {
  it('first send is the snapshot with the output produced before attach', async () => {
    const session = startFake();
    await attachReady(session);
    const late = new RecordingViewer();
    session.attach(late);
    await waitFor(() => late.frames.length > 0, 'snapshot');
    expect(late.frames[0]).toContain('FAKE-CLI');
    expect(late.frames[0]).toContain('READY');
  });

  it('then forwards live output', async () => {
    const session = startFake();
    const viewer = await attachReady(session);
    const before = viewer.frames.length;
    session.write('live\r');
    await waitFor(() => viewer.frames.slice(before).join('').includes('LINE:live'), 'live output');
  });

  it('pty output reaches the mirror when no viewer is attached', async () => {
    const session = startFake();
    await delay(800);
    session.write('unseen\r');
    await delay(500);
    const viewer = new RecordingViewer();
    session.attach(viewer);
    await waitFor(() => viewer.frames.length > 0, 'snapshot');
    expect(viewer.frames[0]).toContain('READY');
    expect(viewer.frames[0]).toContain('LINE:unseen');
  });

  it('snapshot plus live output lose and repeat nothing while output flows', async () => {
    const session = startFake();
    await attachReady(session);
    session.write('COUNT\r');
    await delay(400);
    const late = new RecordingViewer();
    session.attach(late);
    await waitFor(() => late.text.includes('COUNT-DONE'), 'count end', 15_000);
    const numberedLines = (await renderLines(late.text)).filter((line) => /^L\d{5}$/.test(line));
    const expected = Array.from({ length: 400 }, (_, i) => `L${String(i + 1).padStart(5, '0')}`);
    expect(numberedLines).toEqual(expected);
  });

  it('several viewers each get the full sequence', async () => {
    const session = startFake();
    const first = await attachReady(session);
    const second = await attachReady(session);
    session.write('both\r');
    await waitFor(() => first.text.includes('LINE:both') && second.text.includes('LINE:both'), 'both viewers');
  });

  it('detach stops delivery and the process keeps running', async () => {
    const session = startFake();
    const leaving = await attachReady(session);
    const staying = await attachReady(session);
    const detach = session.attach(leaving);
    detach();
    const count = leaving.frames.length;
    session.write('after\r');
    await waitFor(() => staying.text.includes('LINE:after'), 'output after detach');
    await delay(200);
    expect(leaving.frames.length).toBe(count);
    expect(session.exited).toBe(false);
  });

  it('detaching every viewer never stops the process', async () => {
    const session = startFake();
    const viewer = new RecordingViewer();
    const detach = session.attach(viewer);
    await waitFor(() => viewer.text.includes('READY'), 'banner');
    detach();
    await delay(500);
    expect(session.exited).toBe(false);
    const again = new RecordingViewer();
    session.attach(again);
    session.write('still-here\r');
    await waitFor(() => again.text.includes('LINE:still-here'), 'process still answers');
  });

  it('calls end() once when the process ends', async () => {
    const session = startFake();
    const viewer = await attachReady(session);
    session.write('/exit\r');
    await waitFor(() => viewer.ended > 0, 'end');
    await delay(300);
    expect(viewer.ended).toBe(1);
  });

  it('attaching to an ended session sends the snapshot, then end()', async () => {
    const session = startFake();
    await attachReady(session);
    session.write('/exit\r');
    await waitFor(() => session.exited, 'exit');
    const late = new RecordingViewer();
    const calls: string[] = [];
    session.attach({
      send: (data) => {
        calls.push('send');
        late.send(data);
      },
      end: () => {
        calls.push('end');
        late.end();
      },
    });
    await waitFor(() => late.ended > 0, 'end');
    await delay(200);
    expect(calls).toEqual(['send', 'end']);
    expect(late.frames[0]).toContain('BYE');
  });
});

describe('Session.stop', () => {
  const stopped: Session[] = [];
  let exitsOnSigterm: string;
  let ignoresSigterm: string;

  beforeAll(async () => {
    exitsOnSigterm = await writeSigtermScript(workDir, 'exits-on-sigterm.mjs', 'exit');
    ignoresSigterm = await writeSigtermScript(workDir, 'ignores-sigterm.mjs', 'ignore');
  });

  afterAll(async () => {
    for (const session of stopped) session.stop();
    await waitFor(() => stopped.every((session) => session.exited), 'stopped sessions exit', 8000);
  });

  async function startStoppable(command: string, stopTimeoutMs?: number) {
    const registry = new SessionRegistry(stopTimeoutMs === undefined ? { command } : { command, stopTimeoutMs });
    const session = registry.start(workDir);
    stopped.push(session);
    const viewer = await attachReady(session);
    let exits = 0;
    session.onExit(() => {
      exits += 1;
    });
    return { session, viewer, exits: () => exits };
  }

  const sigterms = (viewer: RecordingViewer) => viewer.text.split('GOT-SIGTERM').length - 1;

  // plan-claude_sessions_client/REQ-23, SessionRegistry: stop() sends SIGTERM and the end follows the normal path
  it('sends SIGTERM; a process that ends on it exits with onExit and viewer end()', async () => {
    const { session, viewer, exits } = await startStoppable(exitsOnSigterm, 10_000);
    session.stop();
    await waitFor(() => session.exited, 'exit on SIGTERM', 3000);
    expect(sigterms(viewer)).toBe(1);
    await delay(100);
    expect(exits()).toBe(1);
    expect(viewer.ended).toBe(1);
  });

  // plan-claude_sessions_client/REQ-23, SessionRegistry: SIGKILL after stopTimeoutMs when the process is still alive
  it('sends SIGKILL after stopTimeoutMs to a process that survives SIGTERM', async () => {
    const { session, viewer, exits } = await startStoppable(ignoresSigterm, 1000);
    session.stop();
    await waitFor(() => sigterms(viewer) === 1, 'SIGTERM received');
    await delay(500);
    expect(session.exited, 'still alive before stopTimeoutMs').toBe(false);
    await waitFor(() => session.exited, 'exit after SIGKILL', 3000);
    await delay(100);
    expect(exits()).toBe(1);
    expect(viewer.ended).toBe(1);
  });

  // plan-claude_sessions_client/REQ-23, SessionRegistry: stopTimeoutMs defaults to 5000
  it('waits 5 seconds by default before SIGKILL', async () => {
    const { session, viewer } = await startStoppable(ignoresSigterm);
    const stoppedAt = Date.now();
    session.stop();
    await waitFor(() => sigterms(viewer) === 1, 'SIGTERM received');
    await delay(4500 - (Date.now() - stoppedAt));
    expect(session.exited, 'still alive at 4.5 s').toBe(false);
    await waitFor(() => session.exited, 'exit after SIGKILL', 3000);
    expect(Date.now() - stoppedAt).toBeGreaterThanOrEqual(5000);
  }, 15_000);

  // plan-claude_sessions_client/REQ-23, SessionRegistry: stop() while a previous stop() waits has no effect
  it('a second stop() while the first waits sends no signal and does not delay SIGKILL', async () => {
    const { session, viewer } = await startStoppable(ignoresSigterm, 1000);
    const stoppedAt = Date.now();
    session.stop();
    await waitFor(() => sigterms(viewer) === 1, 'SIGTERM received');
    await delay(700 - (Date.now() - stoppedAt));
    session.stop();
    await waitFor(() => session.exited, 'exit after SIGKILL', 3000);
    expect(Date.now() - stoppedAt, 'SIGKILL timer of the first stop()').toBeLessThan(1500);
    expect(sigterms(viewer)).toBe(1);
  });

  // plan-claude_sessions_client/REQ-23, SessionRegistry: stop() after the process ended has no effect
  it('stop() after the process ended has no effect', async () => {
    const { session, viewer, exits } = await startStoppable(FAKE_CLI);
    session.write('/exit\r');
    await waitFor(() => session.exited, 'exit');
    await delay(100);
    expect(() => session.stop()).not.toThrow();
    await delay(300);
    expect(session.exited).toBe(true);
    expect(exits()).toBe(1);
    expect(viewer.ended).toBe(1);
  });

  // plan-session_notifications/REQ-22, SessionRegistry: stopRequested is true from the stop() call and never goes back
  it('stopRequested becomes true at the stop() call and stays true after the end', async () => {
    const { session } = await startStoppable(exitsOnSigterm, 10_000);
    expect(session.stopRequested).toBe(false);
    session.stop();
    expect(session.stopRequested).toBe(true);
    await waitFor(() => session.exited, 'exit on SIGTERM', 3000);
    expect(endReport(session)).toEqual({ exitCode: 0, signal: undefined, stopRequested: true });
  });

  // plan-session_notifications/REQ-22, SessionRegistry: a stop that ends in SIGKILL is still a stop
  it('a process ended by the SIGKILL of stop() reports signal 9 and stopRequested', async () => {
    const { session } = await startStoppable(ignoresSigterm, 500);
    session.stop();
    await waitFor(() => session.exited, 'exit after SIGKILL', 3000);
    expect(endReport(session)).toEqual({ exitCode: undefined, signal: 9, stopRequested: true });
  });

  // plan-session_notifications/REQ-22, SessionRegistry: a process that SIGTERM ends
  it('a process ended by the SIGTERM of stop() reports signal 15 and stopRequested', async () => {
    const { session } = await startStoppable(FAKE_CLI);
    session.stop();
    await waitFor(() => session.exited, 'exit on SIGTERM', 3000);
    expect(endReport(session)).toEqual({ exitCode: undefined, signal: 15, stopRequested: true });
  });

  // SessionRegistry: stopRequested is true only for a stop() called while the process runs
  it('stop() after the process ended leaves stopRequested false', async () => {
    const { session } = await startStoppable(FAKE_CLI);
    session.write('/exit\r');
    await waitFor(() => session.exited, 'exit');
    session.stop();
    expect(session.stopRequested).toBe(false);
  });
});

describe('Session exitCode and signal', () => {
  // SessionRegistry: nothing to report while the process runs
  it('are undefined, and stopRequested false, while the process runs', async () => {
    const session = startFake();
    await attachReady(session);
    expect(endReport(session)).toEqual({ exitCode: undefined, signal: undefined, stopRequested: false });
  });

  // plan-session_notifications/REQ-22: the user's exit command ends with code 0
  it('give exit code 0 and no signal when the process exits with code 0', async () => {
    const session = startFake();
    await attachReady(session);
    session.write('/exit\r');
    await waitFor(() => session.exited, 'process exit');
    expect(endReport(session)).toEqual({ exitCode: 0, signal: undefined, stopRequested: false });
  });

  // plan-session_notifications/REQ-21, REQ-23
  it('give the exit code and no signal when the process exits by itself with another code', async () => {
    const session = startFake();
    await attachReady(session);
    session.write('/crash 3\r');
    await waitFor(() => session.exited, 'process exit');
    expect(endReport(session)).toEqual({ exitCode: 3, signal: undefined, stopRequested: false });
  });

  // plan-session_notifications/REQ-21: kill -9 from another terminal
  it('give signal 9 and no exit code when a SIGKILL from outside ends the process', async () => {
    const session = startFake();
    await attachReady(session);
    process.kill(session.pid, 'SIGKILL');
    await waitFor(() => session.exited, 'process exit');
    expect(endReport(session)).toEqual({ exitCode: undefined, signal: 9, stopRequested: false });
  });

  // plan-session_notifications/REQ-21
  it('give signal 15 and no exit code when a SIGTERM from outside ends the process', async () => {
    const session = startFake();
    await attachReady(session);
    process.kill(session.pid, 'SIGTERM');
    await waitFor(() => session.exited, 'process exit');
    expect(endReport(session)).toEqual({ exitCode: undefined, signal: 15, stopRequested: false });
  });

  // SessionRegistry: exitCode and signal are already set when the onExit listeners run
  it('are set before the onExit listeners run', async () => {
    const crashed = startFake();
    const killed = startFake();
    const seen: Record<string, ReturnType<typeof endReport>> = {};
    crashed.onExit(() => (seen.crashed = endReport(crashed)));
    killed.onExit(() => (seen.killed = endReport(killed)));
    await attachReady(crashed);
    await attachReady(killed);
    crashed.write('/crash 5\r');
    process.kill(killed.pid, 'SIGKILL');
    await waitFor(() => crashed.exited && killed.exited, 'both exits');
    expect(seen).toEqual({
      crashed: { exitCode: 5, signal: undefined, stopRequested: false },
      killed: { exitCode: undefined, signal: 9, stopRequested: false },
    });
  });
});
