import { appendFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExternalSessionChange, ExternalSessionSummary } from '../external/external-session-scanner.js';
import { TranscriptReader } from '../external/transcript-reader.js';
import { delay, snapshotTree, tempDir, waitFor } from '../test-support.js';
import type { RunningTool } from './running-tool.js';
import { RunningToolMonitor, type RunningToolMonitorSources } from './running-tool-monitor.js';
import { SessionStateTracker } from './session-state-tracker.js';

type Entry = Record<string, unknown>;
type Reader = RunningToolMonitorSources['reader'];

const toolUse = (id: string, name: string, input?: unknown, extra: Entry = {}): Entry => ({
  type: 'assistant',
  isSidechain: false,
  ...extra,
  message: { role: 'assistant', content: [{ type: 'tool_use', id, name, ...(input === undefined ? {} : { input }) }] },
});
const toolUses = (calls: [string, string, unknown][]): Entry => ({
  type: 'assistant',
  isSidechain: false,
  message: { role: 'assistant', content: calls.map(([id, name, input]) => ({ type: 'tool_use', id, name, input })) },
});
const toolResult = (id: string, extra: Entry = {}): Entry => ({
  type: 'user',
  isSidechain: false,
  ...extra,
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'done' }] },
});
const userText = (text: string, extra: Entry = {}): Entry => ({ type: 'user', isSidechain: false, ...extra, message: { role: 'user', content: text } });
const lines = (...entries: Entry[]) => entries.map((entry) => `${JSON.stringify(entry)}\n`).join('');

class FakeScanner {
  readonly sessions = new Map<string, ExternalSessionSummary>();
  readonly #listeners = new Set<(change: ExternalSessionChange) => void>();

  list(): ExternalSessionSummary[] {
    return [...this.sessions.values()];
  }

  onChange(listener: (change: ExternalSessionChange) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  put(id: string, folder: string, state: ExternalSessionSummary['state']): void {
    const session: ExternalSessionSummary = { id, folder, label: 'external', state, lastActivity: '2026-11-06T09:00:00.000Z', external: true };
    this.sessions.set(id, session);
    for (const listener of this.#listeners) listener({ type: 'session', session });
  }

  remove(id: string): void {
    this.sessions.delete(id);
    for (const listener of this.#listeners) listener({ type: 'session-removed', id });
  }
}

let claudeDir: string;
let tracker: SessionStateTracker;
let scanner: FakeScanner;
let reader: TranscriptReader;
let monitor: RunningToolMonitor | undefined;
let changes: [string, RunningTool | undefined][];
let nextId = 0;

const transcriptOf = (folder: string, claudeSessionId: string) =>
  path.join(claudeDir, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'), `${claudeSessionId}.jsonl`);

async function append(file: string, text: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, text);
}

function newMonitor(sourceReader: Reader = reader, intervalMs?: number): RunningToolMonitor {
  monitor = new RunningToolMonitor({ tracker, scanner, reader: sourceReader, ...(intervalMs === undefined ? {} : { intervalMs }) });
  monitor.onChange((id, tool) => changes.push([id, tool]));
  return monitor;
}

/** A hosted session in `working`, with its transcript file path. */
function hostedWorking(claudeSessionId: string | null = `claude-${nextId + 1}`): { id: string; file: string } {
  nextId += 1;
  const id = `hosted-${nextId}`;
  const folder = `/projects/hosted-${nextId}`;
  tracker.track({ id, cwd: folder, onExit: () => {} });
  tracker.applyHookEvent(id, { hook_event_name: 'UserPromptSubmit', prompt: 'Run the tests', ...(claudeSessionId ? { session_id: claudeSessionId } : {}) });
  return { id, file: transcriptOf(folder, claudeSessionId ?? 'none') };
}

function externalSession(state: ExternalSessionSummary['state'] = 'working'): { id: string; file: string } {
  nextId += 1;
  const id = `0a1b2c3d-0000-4000-8000-${String(nextId).padStart(12, '0')}`;
  const folder = `/projects/external-${nextId}`;
  scanner.put(id, folder, state);
  return { id, file: transcriptOf(folder, id) };
}

const changesOf = (id: string) => changes.filter(([changed]) => changed === id).map(([, tool]) => tool);

beforeEach(async () => {
  claudeDir = await tempDir('ai-client-running-tool-');
  tracker = new SessionStateTracker();
  scanner = new FakeScanner();
  reader = new TranscriptReader({ claudeDir });
  changes = [];
});

afterEach(async () => {
  monitor?.stop();
  monitor = undefined;
  vi.useRealTimers();
  await rm(claudeDir, { recursive: true, force: true });
});

describe('RunningToolMonitor, open calls', () => {
  // plan-session_list_improvements/REQ-14: a working hosted session shows the tool of its main transcript
  it('gives the open call of a working hosted session and notifies it', async () => {
    const { id, file } = hostedWorking();
    newMonitor();
    await append(file, lines(userText('Run the tests'), toolUse('t1', 'Bash', { command: 'npm test' })));
    await monitor!.poll();
    expect(monitor!.get(id)).toEqual({ name: 'Bash', argument: 'npm test', others: 0 });
    expect(changesOf(id)).toEqual([{ name: 'Bash', argument: 'npm test', others: 0 }]);
  });

  // plan-session_list_improvements/REQ-14: a working external session shows the tool of its main transcript
  it('gives the open call of a working external session', async () => {
    const { id, file } = externalSession();
    newMonitor();
    await append(file, lines(toolUse('t1', 'Read', { file_path: '/srv/app/src/main.ts' })));
    await monitor!.poll();
    expect(monitor!.get(id)).toEqual({ name: 'Read', argument: '/srv/app/src/main.ts', others: 0 });
  });

  // RunningToolMonitor contract: at construction it takes the sessions already listed by the tracker and the scanner
  it('follows the sessions listed before its construction', async () => {
    const hosted = hostedWorking();
    const external = externalSession();
    await append(hosted.file, lines(toolUse('t1', 'Grep', { pattern: 'TODO' })));
    await append(external.file, lines(toolUse('t2', 'Glob', { pattern: '**/*.ts' })));
    newMonitor();
    await monitor!.poll();
    expect(monitor!.get(hosted.id)?.name).toBe('Grep');
    expect(monitor!.get(external.id)?.name).toBe('Glob');
  });

  // plan-session_list_improvements/REQ-18: the argument comes from the raw input, first line only
  it('takes the first line of the raw input of the last open call', async () => {
    const { id, file } = hostedWorking();
    newMonitor();
    await append(file, lines(toolUse('t1', 'Bash', { command: 'npm ci\nnpm test\nnpm run build' })));
    await monitor!.poll();
    expect(monitor!.get(id)).toEqual({ name: 'Bash', argument: 'npm ci', others: 0 });
  });

  // plan-session_list_improvements/REQ-16: a call with no main argument gives the name only
  it('gives the tool name only when the input has no main argument', async () => {
    const { id, file } = hostedWorking();
    newMonitor();
    await append(file, lines(toolUse('t1', 'TodoWrite', { todos: [{ content: 1 }] })));
    await monitor!.poll();
    expect(monitor!.get(id)).toEqual({ name: 'TodoWrite', others: 0 });
  });

  // plan-session_list_improvements/REQ-19: several open calls, the last one started and the count of the others
  it('gives the last open call and the number of the others, across lines and blocks', async () => {
    const { id, file } = hostedWorking();
    newMonitor();
    await append(
      file,
      lines(
        toolUse('t1', 'Read', { file_path: '/a.ts' }),
        toolUses([
          ['t2', 'Grep', { pattern: 'x' }],
          ['t3', 'Bash', { command: 'npm test' }],
        ]),
      ),
    );
    await monitor!.poll();
    expect(monitor!.get(id)).toEqual({ name: 'Bash', argument: 'npm test', others: 2 });
  });

  // RunningToolMonitor "Open calls": a result closes only its own call; same last call → only others changes
  it('closes the call of a result and keeps the last open call', async () => {
    const { id, file } = hostedWorking();
    newMonitor();
    await append(
      file,
      lines(
        toolUses([
          ['t1', 'Read', { file_path: '/a.ts' }],
          ['t2', 'Bash', { command: 'npm test' }],
        ]),
      ),
    );
    await monitor!.poll();
    await append(file, lines(toolResult('t1')));
    await monitor!.poll();
    expect(monitor!.get(id)).toEqual({ name: 'Bash', argument: 'npm test', others: 0 });
    expect(changesOf(id)).toEqual([
      { name: 'Bash', argument: 'npm test', others: 1 },
      { name: 'Bash', argument: 'npm test', others: 0 },
    ]);
  });

  // plan-session_list_improvements/REQ-20: tool calls inside a subagent never count
  it('ignores the sidechain lines of a subagent', async () => {
    const { id, file } = hostedWorking();
    newMonitor();
    await append(
      file,
      lines(
        toolUse('task', 'Task', { description: 'Review the batch', prompt: 'Read the files' }),
        userText('Read the files', { isSidechain: true }),
        toolUse('sub1', 'Bash', { command: 'ls' }, { isSidechain: true }),
        toolUse('sub2', 'Read', { file_path: '/b.ts' }, { isSidechain: true }),
      ),
    );
    await monitor!.poll();
    expect(monitor!.get(id)).toEqual({ name: 'Task', argument: 'Review the batch', others: 0 });
  });

  // RunningToolMonitor "Transcript of a session": a hosted session with no Claude Code session id has no tool
  it('gives no tool to a hosted session with no Claude Code session id', async () => {
    const { id } = hostedWorking(null);
    newMonitor();
    await append(transcriptOf(tracker.get(id)!.folder, 'fake'), lines(toolUse('t1', 'Bash', { command: 'ls' })));
    await monitor!.poll();
    expect(monitor!.get(id)).toBeUndefined();
    expect(changesOf(id)).toEqual([]);
  });

  // RunningToolMonitor "Transcript of a session": no file yet → no tool; the next poll tries again
  it('finds the transcript when it appears after a first poll', async () => {
    const { id, file } = externalSession();
    newMonitor();
    await monitor!.poll();
    expect(monitor!.get(id)).toBeUndefined();
    await append(file, lines(toolUse('t1', 'Bash', { command: 'npm test' })));
    await monitor!.poll();
    expect(monitor!.get(id)?.name).toBe('Bash');
  });

  // RunningToolMonitor contract: only complete lines are read, the first poll from the start, later polls only the new lines
  it('reads complete lines only, from the start, then only the new lines', async () => {
    const offsets: number[] = [];
    const counting: Reader = {
      locate: (cwd, sessionId) => reader.locate(cwd, sessionId),
      readItem: (file, ref) => reader.readItem(file, ref),
      readFrom: (file, offset) => {
        offsets.push(offset);
        return reader.readFrom(file, offset);
      },
    };
    const { id, file } = hostedWorking();
    newMonitor(counting);
    const first = lines(userText('Run the tests'));
    const call = JSON.stringify(toolUse('t1', 'Bash', { command: 'npm test' }));
    await append(file, first + call);
    await monitor!.poll();
    expect(monitor!.get(id), 'a partial line gives no tool').toBeUndefined();
    await append(file, '\n');
    await monitor!.poll();
    expect(monitor!.get(id)?.name).toBe('Bash');
    expect(offsets[0]).toBe(0);
    expect(offsets.at(-1)).toBe(Buffer.byteLength(first));
  });

  // plan-session_list_improvements/REQ-23: only working sessions are read, other states have no tool
  it('gives no tool to sessions that are not working', async () => {
    const idle = hostedWorking();
    tracker.applyHookEvent(idle.id, { hook_event_name: 'Stop' });
    const asking = hostedWorking();
    tracker.applyHookEvent(asking.id, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
    const externalIdle = externalSession('idle');
    const externalAsking = externalSession('needs_input');
    for (const session of [idle, asking, externalIdle, externalAsking]) await append(session.file, lines(toolUse('t1', 'Bash', { command: 'ls' })));
    newMonitor();
    await monitor!.poll();
    for (const session of [idle, asking, externalIdle, externalAsking]) expect(monitor!.get(session.id), session.id).toBeUndefined();
    expect(changes).toEqual([]);
  });

  // RunningToolMonitor invariant: it never writes under the Claude Code folder
  it('writes nothing under the Claude Code folder', async () => {
    const { file } = hostedWorking();
    await append(file, lines(toolUse('t1', 'Bash', { command: 'npm test' }), toolResult('t1')));
    const before = await snapshotTree(claudeDir);
    newMonitor();
    await monitor!.poll();
    await monitor!.poll();
    expect(await snapshotTree(claudeDir)).toEqual(before);
  });

  // RunningToolMonitor invariant: a failed read changes nothing and the next poll runs as usual
  it('keeps the tool when a read fails and reads again at the next poll', async () => {
    let fail = false;
    const failing: Reader = {
      locate: (cwd, sessionId) => reader.locate(cwd, sessionId),
      readItem: (file, ref) => reader.readItem(file, ref),
      readFrom: (file, offset) => (fail ? Promise.reject(new Error('EIO')) : reader.readFrom(file, offset)),
    };
    const { id, file } = hostedWorking();
    newMonitor(failing);
    await append(file, lines(toolUse('t1', 'Bash', { command: 'npm test' })));
    await monitor!.poll();
    fail = true;
    await append(file, lines(toolUse('t2', 'Read', { file_path: '/a.ts' })));
    await expect(monitor!.poll()).resolves.toBeUndefined();
    expect(monitor!.get(id)?.name).toBe('Bash');
    fail = false;
    await monitor!.poll();
    expect(monitor!.get(id)).toEqual({ name: 'Read', argument: '/a.ts', others: 1 });
  });

  // RunningToolMonitor contract: onChange returns an unsubscribe function
  it('stops notifying a listener after its unsubscribe', async () => {
    const { id, file } = hostedWorking();
    newMonitor();
    const seen: string[] = [];
    const unsubscribe = monitor!.onChange((changed) => seen.push(changed));
    unsubscribe();
    await append(file, lines(toolUse('t1', 'Bash', { command: 'ls' })));
    await monitor!.poll();
    expect(changesOf(id)).toHaveLength(1);
    expect(seen).toEqual([]);
  });
});

describe('RunningToolMonitor, shown tool over time', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
  });

  // plan-session_list_improvements/REQ-21: a fast tool stays shown for 1 second
  it('keeps a tool that ended after 0.2 s until it was shown for 1 s', async () => {
    const { id, file } = hostedWorking();
    newMonitor();
    await append(file, lines(toolUse('t1', 'Bash', { command: 'true' })));
    await monitor!.poll();
    vi.advanceTimersByTime(200);
    await append(file, lines(toolResult('t1')));
    await monitor!.poll();
    expect(monitor!.get(id)?.name).toBe('Bash');
    vi.advanceTimersByTime(799);
    expect(monitor!.get(id)?.name, 'at 0.999 s').toBe('Bash');
    expect(changesOf(id)).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(monitor!.get(id), 'at 1 s').toBeUndefined();
    expect(changesOf(id)).toEqual([{ name: 'Bash', argument: 'true', others: 0 }, undefined]);
  });

  // plan-session_list_improvements/REQ-22: a tool shown for 1 s or more disappears at the poll that sees its end
  it('removes a tool shown for more than 1 s as soon as no call is open', async () => {
    const { id, file } = hostedWorking();
    newMonitor();
    await append(file, lines(toolUse('t1', 'Bash', { command: 'npm test' })));
    await monitor!.poll();
    vi.advanceTimersByTime(1500);
    await append(file, lines(toolResult('t1')));
    await monitor!.poll();
    expect(monitor!.get(id)).toBeUndefined();
    expect(changesOf(id).at(-1)).toBeUndefined();
  });

  // plan-session_list_improvements/REQ-22: a user item closes every open call
  it('clears every open call on a user item', async () => {
    const { id, file } = hostedWorking();
    newMonitor();
    await append(
      file,
      lines(
        toolUses([
          ['t1', 'Read', { file_path: '/a.ts' }],
          ['t2', 'Bash', { command: 'npm test' }],
        ]),
      ),
    );
    await monitor!.poll();
    vi.advanceTimersByTime(1500);
    await append(file, lines(userText('Stop, do something else')));
    await monitor!.poll();
    expect(monitor!.get(id)).toBeUndefined();
  });

  // plan-session_list_improvements/REQ-21: another tool replaces the shown one at once
  it('replaces a held tool at once with a new call', async () => {
    const { id, file } = hostedWorking();
    newMonitor();
    await append(file, lines(toolUse('t1', 'Bash', { command: 'true' })));
    await monitor!.poll();
    vi.advanceTimersByTime(200);
    await append(file, lines(toolResult('t1'), toolUse('t2', 'Read', { file_path: '/a.ts' })));
    await monitor!.poll();
    expect(monitor!.get(id)).toEqual({ name: 'Read', argument: '/a.ts', others: 0 });
  });

  // plan-session_list_improvements/REQ-21: a new call during a hold starts its own second
  it('does not let the pending hold of an old tool clear a newer one', async () => {
    const { id, file } = hostedWorking();
    newMonitor();
    await append(file, lines(toolUse('t1', 'Bash', { command: 'true' })));
    await monitor!.poll();
    vi.advanceTimersByTime(200);
    await append(file, lines(toolResult('t1')));
    await monitor!.poll();
    vi.advanceTimersByTime(300);
    await append(file, lines(toolUse('t2', 'Read', { file_path: '/a.ts' })));
    await monitor!.poll();
    vi.advanceTimersByTime(600);
    expect(monitor!.get(id)?.name, 'at 1.1 s, Read shown for 0.6 s').toBe('Read');
    await append(file, lines(toolResult('t2')));
    await monitor!.poll();
    expect(monitor!.get(id)?.name, 'Read held until it was shown for 1 s').toBe('Read');
    vi.advanceTimersByTime(400);
    expect(monitor!.get(id)).toBeUndefined();
  });

  // plan-session_list_improvements/REQ-21, REQ-23: the turn ends → no tool at once, even within the hold
  it('drops the tool at once when a hosted session leaves working', async () => {
    const { id, file } = hostedWorking();
    newMonitor();
    await append(file, lines(toolUse('t1', 'Bash', { command: 'npm test' })));
    await monitor!.poll();
    vi.advanceTimersByTime(100);
    tracker.applyHookEvent(id, { hook_event_name: 'Stop' });
    expect(monitor!.get(id)).toBeUndefined();
    expect(changesOf(id).at(-1)).toBeUndefined();
    expect(changesOf(id)).toHaveLength(2);
  });

  // plan-session_list_improvements/REQ-23: an external session that leaves working or is removed has no tool at once
  it('drops the tool at once when an external session leaves working or is removed', async () => {
    const asking = externalSession();
    const removed = externalSession();
    newMonitor();
    await append(asking.file, lines(toolUse('t1', 'Bash', { command: 'npm test' })));
    await append(removed.file, lines(toolUse('t1', 'Bash', { command: 'npm test' })));
    await monitor!.poll();
    scanner.put(asking.id, scanner.sessions.get(asking.id)!.folder, 'needs_input');
    scanner.remove(removed.id);
    expect(monitor!.get(asking.id)).toBeUndefined();
    expect(monitor!.get(removed.id)).toBeUndefined();
    expect(changesOf(asking.id)).toEqual([{ name: 'Bash', argument: 'npm test', others: 0 }, undefined]);
    expect(changesOf(removed.id)).toEqual([{ name: 'Bash', argument: 'npm test', others: 0 }, undefined]);
  });

  // RunningToolMonitor "Transcript of a session": a new Claude Code session id drops the old transcript and its calls
  it('drops the open calls of the old transcript when the Claude Code session id changes', async () => {
    const { id, file } = hostedWorking('claude-old');
    newMonitor();
    await append(file, lines(toolUse('t1', 'Bash', { command: 'npm test' })));
    await monitor!.poll();
    vi.advanceTimersByTime(1500);
    tracker.applyHookEvent(id, { hook_event_name: 'UserPromptSubmit', prompt: 'Again', session_id: 'claude-new' });
    expect(tracker.claudeSessionId(id)).toBe('claude-new');
    await monitor!.poll();
    expect(monitor!.get(id), 'old open calls dropped, new transcript not found yet').toBeUndefined();
    await writeFile(transcriptOf(tracker.get(id)!.folder, 'claude-new'), lines(toolUse('n1', 'Read', { file_path: '/new.ts' })));
    await monitor!.poll();
    expect(monitor!.get(id)?.name).toBe('Read');
  });

  // RunningToolMonitor contract: stop() leaves no pending change from the hold rule
  it('makes no pending change after stop', async () => {
    const { id, file } = hostedWorking();
    newMonitor();
    await append(file, lines(toolUse('t1', 'Bash', { command: 'true' })));
    await monitor!.poll();
    vi.advanceTimersByTime(200);
    await append(file, lines(toolResult('t1')));
    await monitor!.poll();
    monitor!.stop();
    vi.advanceTimersByTime(2000);
    expect(changesOf(id)).toHaveLength(1);
  });
});

describe('RunningToolMonitor, start and stop', () => {
  // plan-session_list_improvements/REQ-24: with the default interval a tool shows well within 2 s of its line
  it('shows a tool within one interval after its line reaches the transcript, and reads nothing after stop', async () => {
    const { id, file } = externalSession();
    newMonitor();
    monitor!.start();
    await delay(100);
    const written = Date.now();
    await append(file, lines(toolUse('t1', 'Bash', { command: 'npm test' })));
    await waitFor(() => monitor!.get(id) !== undefined, 'tool shown', 2000);
    expect(Date.now() - written).toBeLessThan(1000);
    monitor!.stop();
    await append(file, lines(toolUse('t2', 'Read', { file_path: '/a.ts' })));
    await delay(800);
    expect(monitor!.get(id)?.name).toBe('Bash');
  });

  // RunningToolMonitor contract: a second start() changes nothing
  it('runs a single read loop after two starts', async () => {
    let reads = 0;
    const counting: Reader = {
      locate: (cwd, sessionId) => reader.locate(cwd, sessionId),
      readItem: (file, ref) => reader.readItem(file, ref),
      readFrom: (file, offset) => {
        reads += 1;
        return reader.readFrom(file, offset);
      },
    };
    const { file } = hostedWorking();
    await append(file, lines(userText('Run the tests')));
    newMonitor(counting, 100);
    monitor!.start();
    monitor!.start();
    await delay(450);
    monitor!.stop();
    expect(reads).toBeGreaterThanOrEqual(2);
    expect(reads).toBeLessThanOrEqual(5);
  });
});
