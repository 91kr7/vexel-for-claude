import { describe, expect, it, vi } from 'vitest';
import type { ProcessFacts } from './process-reader.js';
import { ProcessTerminator, type ProcessTerminatorDeps } from './process-terminator.js';
import { APP, fakeClaude, fact, server } from './processes-test-support.js';

// Unit tests of the ProcessTerminator spec, plan-app_processes/REQ-23, REQ-28, REQ-29, REQ-30, REQ-32:
// a fake reader, registry and signal call stand in for /proc, the sessions and process.kill.
const OWN = 10;
const TARGET = 20;
const FACTS: ProcessFacts[] = [server(OWN), fakeClaude(TARGET, 999)];
const target = FACTS[1]!;

interface FakeSession {
  pid: number;
  exited: boolean;
  stop: ReturnType<typeof vi.fn<() => void>>;
  onExit(listener: () => void): () => void;
}

/** A hosted session; `exitsOnStop` → it exits soon after `stop()`. */
function fakeSession(pid: number, exitsOnStop: boolean, exited = false): FakeSession {
  const listeners: Array<() => void> = [];
  const session: FakeSession = {
    pid,
    exited,
    stop: vi.fn(() => {
      if (!exitsOnStop) return;
      setTimeout(() => {
        session.exited = true;
        for (const listener of listeners) listener();
      }, 20);
    }),
    onExit: (listener) => {
      listeners.push(listener);
      return () => listeners.splice(listeners.indexOf(listener), 1);
    },
  };
  return session;
}

function terminatorWith(options: {
  facts?: ProcessFacts[];
  running?: () => boolean;
  sessions?: FakeSession[];
  signal?: (pid: number, name: NodeJS.Signals) => void;
}) {
  const readProcesses = vi.fn(async () => options.facts ?? FACTS);
  const isRunning = vi.fn(async (_pid: number, _startTicks: string) => (options.running ?? (() => false))());
  const signal = vi.fn(options.signal ?? (() => {}));
  const deps: ProcessTerminatorDeps = {
    reader: { readProcesses, isRunning },
    registry: { list: () => options.sessions ?? [] },
    ownPid: OWN,
    appName: APP,
    signal,
    endTimeoutMs: 300,
    sessionEndTimeoutMs: 300,
    pollMs: 10,
  };
  return { terminator: new ProcessTerminator(deps), signal, readProcesses, isRunning };
}

const errno = (code: string) => Object.assign(new Error(code), { code });

describe('ProcessTerminator identity check', () => {
  // plan-app_processes/REQ-30: a reused PID is never signalled
  it('gives "gone" and sends no signal when the PID now has another start time', async () => {
    const { terminator, signal } = terminatorWith({});
    const result = await terminator.terminate(TARGET, target.startedAt + 1);
    expect(result.outcome).toBe('gone');
    expect(result.afterAnswer).toBeUndefined();
    expect(signal).not.toHaveBeenCalled();
  });

  it('gives "gone" and sends no signal when the PID is no longer listed', async () => {
    const { terminator, signal } = terminatorWith({});
    expect((await terminator.terminate(77, target.startedAt)).outcome).toBe('gone');
    expect(signal).not.toHaveBeenCalled();
  });

  it('gives "gone" and sends no signal when the process has no kind of the app', async () => {
    const other = fact(TARGET);
    const { terminator, signal } = terminatorWith({ facts: [server(OWN), other] });
    expect((await terminator.terminate(TARGET, other.startedAt)).outcome).toBe('gone');
    expect(signal).not.toHaveBeenCalled();
  });

  it.each([0, -5, 1.5, Number.NaN])('gives "gone" for the pid %s with no read and no signal', async (pid) => {
    const { terminator, signal, readProcesses } = terminatorWith({});
    expect((await terminator.terminate(pid, target.startedAt)).outcome).toBe('gone');
    expect(readProcesses).not.toHaveBeenCalled();
    expect(signal).not.toHaveBeenCalled();
  });

  it('reads the processes again at each call', async () => {
    const { terminator, readProcesses } = terminatorWith({});
    await terminator.terminate(TARGET, target.startedAt);
    await terminator.terminate(TARGET, target.startedAt);
    expect(readProcesses).toHaveBeenCalledTimes(2);
  });
});

describe('ProcessTerminator on the current instance', () => {
  // plan-app_processes/REQ-23: the answer comes first, the self SIGTERM only after it
  it('gives "ended" without signalling, and its afterAnswer sends one SIGTERM to the own PID', async () => {
    const own = FACTS[0]!;
    const { terminator, signal } = terminatorWith({});
    const result = await terminator.terminate(OWN, own.startedAt);
    expect(result.outcome).toBe('ended');
    expect(signal).not.toHaveBeenCalled();
    expect(result.afterAnswer).toBeTypeOf('function');
    result.afterAnswer?.();
    expect(signal.mock.calls).toEqual([[OWN, 'SIGTERM']]);
  });
});

describe('ProcessTerminator on a hosted session', () => {
  // plan-app_processes/REQ-28: the same stop as the session list
  it('stops the session with stop(), sends no signal of its own and gives "ended" on its exit', async () => {
    const session = fakeSession(TARGET, true);
    const { terminator, signal } = terminatorWith({ sessions: [session] });
    expect((await terminator.terminate(TARGET, target.startedAt)).outcome).toBe('ended');
    expect(session.stop).toHaveBeenCalledTimes(1);
    expect(signal).not.toHaveBeenCalled();
  });

  // plan-app_processes/REQ-32
  it('gives "running" when the session does not exit within the wait', async () => {
    const session = fakeSession(TARGET, false);
    const { terminator, signal } = terminatorWith({ sessions: [session] });
    expect((await terminator.terminate(TARGET, target.startedAt)).outcome).toBe('running');
    expect(session.stop).toHaveBeenCalledTimes(1);
    expect(signal).not.toHaveBeenCalled();
  });

  it('treats a registry session that already exited as another process', async () => {
    const session = fakeSession(TARGET, false, true);
    const { terminator, signal } = terminatorWith({ sessions: [session] });
    expect((await terminator.terminate(TARGET, target.startedAt)).outcome).toBe('ended');
    expect(session.stop).not.toHaveBeenCalled();
    expect(signal.mock.calls).toEqual([[TARGET, 'SIGTERM']]);
  });
});

describe('ProcessTerminator on another process', () => {
  // plan-app_processes/REQ-29: one SIGTERM to the PID only
  it('sends one SIGTERM to the PID only and gives "ended" when it stops running', async () => {
    const { terminator, signal, isRunning } = terminatorWith({ running: () => false });
    expect((await terminator.terminate(TARGET, target.startedAt)).outcome).toBe('ended');
    expect(signal.mock.calls).toEqual([[TARGET, 'SIGTERM']]);
    expect(isRunning).toHaveBeenCalledWith(TARGET, target.startTicks);
  });

  it('waits while the process still runs and gives "ended" once it stops', async () => {
    let checks = 0;
    const { terminator, signal } = terminatorWith({ running: () => ++checks < 4 });
    expect((await terminator.terminate(TARGET, target.startedAt)).outcome).toBe('ended');
    expect(checks).toBeGreaterThanOrEqual(4);
    expect(signal).toHaveBeenCalledTimes(1);
  });

  // plan-app_processes/REQ-32: no second signal, no SIGKILL
  it('gives "running" when the process still runs at the end of the wait, after one SIGTERM only', async () => {
    const { terminator, signal } = terminatorWith({ running: () => true });
    const started = Date.now();
    expect((await terminator.terminate(TARGET, target.startedAt)).outcome).toBe('running');
    expect(Date.now() - started).toBeGreaterThanOrEqual(250);
    expect(signal.mock.calls).toEqual([[TARGET, 'SIGTERM']]);
  });

  it('gives "not_allowed" when the signal fails with EPERM', async () => {
    const { terminator } = terminatorWith({
      signal: () => {
        throw errno('EPERM');
      },
    });
    expect((await terminator.terminate(TARGET, target.startedAt)).outcome).toBe('not_allowed');
  });

  it('gives "ended" when the signal fails with ESRCH', async () => {
    const { terminator } = terminatorWith({
      running: () => true,
      signal: () => {
        throw errno('ESRCH');
      },
    });
    expect((await terminator.terminate(TARGET, target.startedAt)).outcome).toBe('ended');
  });

  it('gives no afterAnswer for a process other than the current instance', async () => {
    const { terminator } = terminatorWith({});
    expect((await terminator.terminate(TARGET, target.startedAt)).afterAnswer).toBeUndefined();
  });
});
