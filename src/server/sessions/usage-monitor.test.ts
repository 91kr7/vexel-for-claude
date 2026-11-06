import { appendFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ExternalSessionChange, ExternalSessionSummary } from '../external/external-session-scanner.js';
import { TranscriptReader } from '../external/transcript-reader.js';
import { delay, snapshotTree, tempDir, waitFor } from '../test-support.js';
import { SessionStateTracker } from './session-state-tracker.js';
import { type SessionUsage, UsageMonitor, type UsageMonitorSources } from './usage-monitor.js';

type Entry = Record<string, unknown>;
type Reader = UsageMonitorSources['reader'];

let nextKey = 0;
const response = (input: number, cacheWrite = 0, cacheRead = 0, extra: { model?: string; sidechain?: boolean } = {}): Entry => {
  nextKey += 1;
  return {
    type: 'assistant',
    uuid: `line-${nextKey}`,
    isSidechain: extra.sidechain ?? false,
    message: {
      id: `msg_${nextKey}`,
      model: extra.model ?? 'claude-haiku-5-5',
      usage: { input_tokens: input, output_tokens: 777, cache_creation_input_tokens: cacheWrite, cache_read_input_tokens: cacheRead },
    },
  };
};
const userText = (text: string): Entry => ({ type: 'user', isSidechain: false, message: { role: 'user', content: text } });
const compaction: Entry = { type: 'system', subtype: 'compact_boundary' };
const lines = (...entries: Entry[]) => entries.map((entry) => `${JSON.stringify(entry)}\n`).join('');
const context = (used: number, window = 200_000) => ({ used, window });
/** The token totals of responses made by `response()`, whose output is always 777. */
const tokens = (responses: number, input: number, cacheWrite = 0, cacheRead = 0) => ({ input, output: 777 * responses, cacheWrite, cacheRead });

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
let monitor: UsageMonitor | undefined;
let changes: [string, SessionUsage | undefined][];
let nextId = 0;
const exits = new Map<string, () => void>();

const transcriptOf = (folder: string, claudeSessionId: string) =>
  path.join(claudeDir, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'), `${claudeSessionId}.jsonl`);

async function append(file: string, text: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, text);
}

function newMonitor(options: Partial<Omit<UsageMonitorSources, 'tracker' | 'scanner'>> = {}): UsageMonitor {
  monitor = new UsageMonitor({ tracker, scanner, reader, ...options });
  monitor.onChange((id, usage) => changes.push([id, usage]));
  return monitor;
}

/** A hosted session in `state`, with the Claude Code session id its hooks sent, and its transcript path. */
function hosted(state: 'working' | 'idle' = 'working', claudeSessionId: string | null = `claude-${nextId + 1}`): { id: string; folder: string; file: string } {
  nextId += 1;
  const id = `hosted-${nextId}`;
  const folder = `/projects/hosted-${nextId}`;
  tracker.track({ id, cwd: folder, onExit: (listener) => exits.set(id, listener) });
  const event = state === 'working' ? { hook_event_name: 'UserPromptSubmit', prompt: 'Run the tests' } : { hook_event_name: 'Stop' };
  tracker.applyHookEvent(id, { ...event, ...(claudeSessionId ? { session_id: claudeSessionId } : {}) });
  return { id, folder, file: transcriptOf(folder, claudeSessionId ?? 'none') };
}

function external(state: ExternalSessionSummary['state'] = 'idle'): { id: string; file: string } {
  nextId += 1;
  const id = `0a1b2c3d-0000-4000-8000-${String(nextId).padStart(12, '0')}`;
  const folder = `/projects/external-${nextId}`;
  scanner.put(id, folder, state);
  return { id, file: transcriptOf(folder, id) };
}

const changesOf = (id: string) => changes.filter(([changed]) => changed === id).map(([, usage]) => usage);
const contextChangesOf = (id: string) => changesOf(id).map((usage) => usage?.context);
const contextOf = (id: string) => monitor!.get(id)?.context;

/** A reader that counts the calls and can fail on demand. */
function countingReader(): Reader & { reads: number; locates: number; failNext: boolean } {
  const counting = {
    reads: 0,
    locates: 0,
    failNext: false,
    locate: (cwd: string, sessionId: string) => {
      counting.locates += 1;
      return reader.locate(cwd, sessionId);
    },
    readEntriesFrom: (file: string, offset: number, maxBytes?: number) => {
      counting.reads += 1;
      if (counting.failNext) {
        counting.failNext = false;
        return Promise.reject(new Error('EIO'));
      }
      return reader.readEntriesFrom(file, offset, maxBytes);
    },
  };
  return counting;
}

beforeEach(async () => {
  claudeDir = await tempDir('ai-client-usage-');
  tracker = new SessionStateTracker();
  scanner = new FakeScanner();
  reader = new TranscriptReader({ claudeDir });
  changes = [];
  exits.clear();
});

afterEach(async () => {
  monitor?.stop();
  monitor = undefined;
  await rm(claudeDir, { recursive: true, force: true });
});

describe('UsageMonitor, context of a session', () => {
  // plan-session_usage/REQ-1, REQ-3: a hosted session gets the context of its last main response
  it('gives the context of a hosted session and notifies it', async () => {
    const { id, file } = hosted();
    newMonitor();
    await append(file, lines(userText('a'), response(200, 15_000, 30_000)));
    await monitor!.poll();
    const usage = { context: context(45_200), tokens: tokens(1, 200, 15_000, 30_000) };
    expect(monitor!.get(id)).toEqual(usage);
    expect(changesOf(id)).toEqual([usage]);
  });

  // plan-session_usage/REQ-1: an external session, transcript found by its scanner id
  it('gives the context of an external session', async () => {
    const { id, file } = external();
    newMonitor();
    await append(file, lines(response(300_000)));
    await monitor!.poll();
    expect(contextOf(id)).toEqual(context(300_000, 1_000_000));
  });

  // plan-session_usage/REQ-1: every state; UsageMonitor spec: the sessions listed before construction
  it('reads idle sessions and the sessions listed before its construction', async () => {
    const idle = hosted('idle');
    const outside = external('needs_input');
    await append(idle.file, lines(response(10_000)));
    await append(outside.file, lines(response(20_000)));
    newMonitor();
    await monitor!.poll();
    expect(contextOf(idle.id)).toEqual(context(10_000));
    expect(contextOf(outside.id)).toEqual(context(20_000));
  });

  // plan-session_usage/REQ-9: no response, no Claude Code session id, no file → no value; unknown id → none
  it('gives no value before the first main response, with no transcript, and for an unknown id', async () => {
    const empty = hosted();
    const sidechainOnly = hosted();
    const noClaudeId = hosted('working', null);
    const noFile = external();
    await append(empty.file, lines(userText('hello')));
    await append(sidechainOnly.file, lines(userText('hello'), response(9_000, 0, 0, { sidechain: true })));
    newMonitor();
    await monitor!.poll();
    for (const id of [empty.id, noClaudeId.id, noFile.id, 'unknown']) expect(monitor!.get(id), id).toBeUndefined();
    expect(monitor!.get(sidechainOnly.id), 'tokens only, no context').toEqual({ tokens: tokens(1, 9_000) });
    expect(changes).toEqual([[sidechainOnly.id, { tokens: tokens(1, 9_000) }]]);
  });

  // UsageMonitor spec: no file found yet → the next poll tries again
  it('finds a transcript that appears after the first poll', async () => {
    const { id, file } = external();
    newMonitor();
    await monitor!.poll();
    await append(file, lines(response(12_000)));
    await monitor!.poll();
    expect(contextOf(id)).toEqual(context(12_000));
  });

  // plan-session_usage/REQ-6, REQ-7, REQ-14: later polls apply subagent answers and compactions on top of the value
  it('keeps the context on a subagent answer, clears it at a compaction, and sets it at the next answer', async () => {
    const { id, file } = hosted();
    newMonitor();
    await append(file, lines(response(80_000)));
    await monitor!.poll();
    await append(file, lines(response(4_000, 0, 0, { sidechain: true })));
    await monitor!.poll();
    expect(monitor!.get(id)).toEqual({ context: context(80_000), tokens: tokens(2, 84_000) });
    await append(file, lines(compaction));
    await monitor!.poll();
    expect(monitor!.get(id), 'no context after a compaction, the tokens stay').toEqual({ tokens: tokens(2, 84_000) });
    await append(file, lines(response(15_000)));
    await monitor!.poll();
    expect(monitor!.get(id)).toEqual({ context: context(15_000), tokens: tokens(3, 99_000) });
    expect(contextChangesOf(id)).toEqual([context(80_000), context(80_000), undefined, context(15_000)]);
  });

  // UsageMonitor spec: onChange only when get(id) changes
  it('does not notify when a poll gives the same value', async () => {
    const { id, file } = hosted();
    newMonitor();
    await append(file, lines(response(50_000)));
    await monitor!.poll();
    await monitor!.poll();
    await append(file, lines(userText('again')));
    await monitor!.poll();
    expect(changesOf(id)).toEqual([{ context: context(50_000), tokens: tokens(1, 50_000) }]);
  });
});

describe('UsageMonitor, session lifecycle', () => {
  // plan-session_usage/REQ-10, REQ-19: an ended session keeps its last value until it leaves the tracker
  it('keeps the value of an ended hosted session, then drops it with no event when the session is dismissed', async () => {
    const { id, file } = hosted();
    newMonitor();
    await append(file, lines(response(80_000)));
    await monitor!.poll();
    exits.get(id)!();
    expect(tracker.get(id)?.state).toBe('ended');
    await monitor!.poll();
    expect(monitor!.get(id)).toEqual({ context: context(80_000), tokens: tokens(1, 80_000) });

    const before = changes.length;
    expect(tracker.dismiss(id)).toBe(true);
    await monitor!.poll();
    expect(monitor!.get(id)).toBeUndefined();
    expect(changes.length).toBe(before);
  });

  // UsageMonitor spec: a scanner removal drops the value with no event
  it('drops the value of a removed external session with no event', async () => {
    const { id, file } = external();
    newMonitor();
    await append(file, lines(response(30_000)));
    await monitor!.poll();
    const before = changes.length;
    scanner.remove(id);
    expect(monitor!.get(id)).toBeUndefined();
    await monitor!.poll();
    expect(monitor!.get(id)).toBeUndefined();
    expect(changes.length).toBe(before);
  });

  // UsageMonitor spec: a new Claude Code session id drops the old transcript and its value, with a change
  it('drops the old value when the Claude Code session id of a hosted session changes, then follows the new transcript', async () => {
    const { id, folder, file } = hosted('working', 'claude-old');
    newMonitor();
    await append(file, lines(response(90_000)));
    await monitor!.poll();
    tracker.applyHookEvent(id, { hook_event_name: 'UserPromptSubmit', prompt: 'after clear', session_id: 'claude-new' });
    await monitor!.poll();
    expect(monitor!.get(id)).toBeUndefined();
    expect(contextChangesOf(id)).toEqual([context(90_000), undefined]);
    expect(changesOf(id)[1]).toBeUndefined();

    await append(transcriptOf(folder, 'claude-new'), lines(response(3_000)));
    await monitor!.poll();
    expect(contextOf(id)).toEqual(context(3_000));
  });
});

describe('UsageMonitor, reading', () => {
  // plan-session_usage/REQ-21: a large transcript is read over several polls; get keeps its value until the end
  it('reads a large transcript over several polls and publishes only at the end of the file', async () => {
    const { id, file } = hosted();
    newMonitor({ maxBytesPerPoll: 1_000 });
    await append(file, lines(response(10_000)));
    await monitor!.poll();
    expect(contextOf(id)).toEqual(context(10_000));

    const filler = Array.from({ length: 40 }, (_, n) => response(n + 1, 0, 0, { sidechain: true }));
    await append(file, lines(response(60_000), ...filler, response(70_000)));
    await monitor!.poll();
    expect(monitor!.get(id), 'the old value until the end of the file').toEqual({ context: context(10_000), tokens: tokens(1, 10_000) });

    let polls = 1;
    while (monitor!.get(id)?.context?.used !== 70_000) {
      await monitor!.poll();
      polls += 1;
      expect(polls, 'the reading ends').toBeLessThan(40);
    }
    expect(polls).toBeGreaterThan(2);
    expect(contextChangesOf(id)).toEqual([context(10_000), context(70_000)]);
  });

  // UsageMonitor spec: the first poll of a large transcript publishes nothing until the end of the file
  it('publishes no value of a large transcript before its last chunk', async () => {
    const { id, file } = external();
    await append(file, lines(response(5_000), ...Array.from({ length: 40 }, () => userText('x'.repeat(50))), response(6_000)));
    newMonitor({ maxBytesPerPoll: 1_000 });
    await monitor!.poll();
    expect(monitor!.get(id)).toBeUndefined();
    for (let n = 0; n < 40 && !monitor!.get(id); n += 1) await monitor!.poll();
    expect(contextOf(id)).toEqual(context(6_000));
    expect(contextChangesOf(id)).toEqual([context(6_000)]);
  });

  // UsageMonitor spec: a failed read changes nothing; the next poll runs as usual
  it('keeps the value on a failed read and goes on at the next poll', async () => {
    const counting = countingReader();
    const { id, file } = hosted();
    newMonitor({ reader: counting });
    await append(file, lines(response(40_000)));
    await monitor!.poll();
    await append(file, lines(response(41_000)));
    counting.failNext = true;
    await monitor!.poll();
    expect(monitor!.get(id)).toEqual({ context: context(40_000), tokens: tokens(1, 40_000) });
    await monitor!.poll();
    expect(monitor!.get(id)).toEqual({ context: context(41_000), tokens: tokens(2, 81_000) });
  });

  // UsageMonitor spec: get reads only values in memory
  it('reads no file in get', async () => {
    const counting = countingReader();
    const { id, file } = hosted();
    await append(file, lines(response(40_000)));
    newMonitor({ reader: counting });
    await monitor!.poll();
    const { reads, locates } = counting;
    for (let n = 0; n < 20; n += 1) monitor!.get(id);
    monitor!.get('unknown');
    expect([counting.reads, counting.locates]).toEqual([reads, locates]);
  });

  // UsageMonitor spec: it never writes under the Claude Code folder
  it('writes nothing under the Claude Code folder', async () => {
    const { file } = hosted();
    await append(file, lines(response(40_000), compaction, response(1_000)));
    const before = await snapshotTree(claudeDir);
    newMonitor();
    await monitor!.poll();
    await monitor!.poll();
    expect(await snapshotTree(claudeDir)).toEqual(before);
  });
});

describe('UsageMonitor, timing', () => {
  // plan-session_usage/REQ-12: with the default interval a new main response shows within 2 seconds
  it('shows a new response within 2 seconds with the default interval', async () => {
    const { id, file } = hosted();
    await append(file, lines(response(1_000)));
    newMonitor();
    monitor!.start();
    await waitFor(() => monitor!.get(id) !== undefined, 'first poll', 1_000);
    await append(file, lines(response(2_000)));
    const written = Date.now();
    await waitFor(() => monitor!.get(id)?.context?.used === 2_000, 'new response', 2_000);
    expect(Date.now() - written).toBeLessThan(2_000);
  });

  // UsageMonitor spec: start polls now, then every intervalMs; a second start changes nothing; stop ends the reads
  it('polls at once and then every interval, once even after a second start, and stops', async () => {
    const counting = countingReader();
    const { id, file } = hosted();
    await append(file, lines(response(1_000)));
    newMonitor({ reader: counting, intervalMs: 100 });
    monitor!.start();
    monitor!.start();
    await waitFor(() => monitor!.get(id) !== undefined, 'first poll', 80);
    await delay(450);
    expect(counting.reads).toBeGreaterThanOrEqual(3);
    expect(counting.reads, 'one loop only').toBeLessThanOrEqual(6);

    monitor!.stop();
    await delay(50);
    const reads = counting.reads;
    await append(file, lines(response(9_000)));
    await delay(300);
    expect(counting.reads).toBe(reads);
    expect(contextOf(id)).toEqual(context(1_000));
  });
});

/** A subagent file of a session, as recent Claude Code versions write it next to the main transcript. */
const subagentFile = (main: string, name: string) => path.join(main.replace(/\.jsonl$/, ''), 'subagents', name);
/** A response line with an explicit key and output, as one of the lines Claude Code writes per content block. */
const block = (key: string, input: number, output: number, sidechain = false): Entry => ({
  type: 'assistant',
  uuid: `${key}-${output}`,
  isSidechain: sidechain,
  message: { id: key, model: 'claude-haiku-5-5', usage: { input_tokens: input, output_tokens: output, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } },
});

/** A reader that records each read: file, start offset and end offset. */
function recordingReader(): Reader & { calls: { file: string; from: number; to: number }[] } {
  const recording = {
    calls: [] as { file: string; from: number; to: number }[],
    locate: (cwd: string, sessionId: string) => reader.locate(cwd, sessionId),
    readEntriesFrom: async (file: string, offset: number, maxBytes?: number) => {
      const result = await reader.readEntriesFrom(file, offset, maxBytes);
      recording.calls.push({ file, from: offset, to: result.offset });
      return result;
    },
  };
  return recording;
}

describe('UsageMonitor, tokens consumed', () => {
  // plan-session_usage/REQ-14: main conversation and subagent files sum up; the subagent files leave the context alone
  it('sums the responses of the main transcript and of every subagent file', async () => {
    const { id, file } = hosted();
    await append(file, lines(userText('a'), response(1_000, 2_000, 3_000), response(10_000)));
    await append(subagentFile(file, 'agent-a1.jsonl'), lines(response(500, 0, 0, { sidechain: true })));
    await append(subagentFile(file, 'agent-b2.jsonl'), lines(response(70, 80, 90, { sidechain: true }), response(300_000)));
    await append(subagentFile(file, 'agent-a1.meta.json'), JSON.stringify(response(9_999_999)));
    newMonitor();
    await monitor!.poll();
    expect(monitor!.get(id)).toEqual({ context: context(10_000), tokens: tokens(5, 311_570, 2_080, 3_090) });
  });

  // plan-session_usage/REQ-15: one response on several lines counts once with its final output, in the main transcript and in a subagent file
  it('counts a response written on several lines once, with its final output', async () => {
    const { id, file } = external();
    await append(file, lines(block('msg_main', 100, 1), block('msg_main', 100, 1), block('msg_main', 100, 420)));
    await append(subagentFile(file, 'agent-a1.jsonl'), lines(block('msg_sub', 10, 2, true), block('msg_sub', 10, 35, true)));
    newMonitor();
    await monitor!.poll();
    expect(monitor!.get(id)?.tokens).toEqual({ input: 110, output: 455, cacheWrite: 0, cacheRead: 0 });
  });

  // plan-session_usage/REQ-15: the final line of a response read at a later poll replaces its early line
  it('replaces an early line of a response with its final line read at a later poll', async () => {
    const { id, file } = hosted();
    newMonitor();
    await append(file, lines(block('msg_1', 100, 1)));
    await append(subagentFile(file, 'agent-a1.jsonl'), lines(block('msg_2', 20, 3, true)));
    await monitor!.poll();
    expect(monitor!.get(id)?.tokens).toEqual({ input: 120, output: 4, cacheWrite: 0, cacheRead: 0 });
    await append(file, lines(block('msg_1', 100, 600)));
    await append(subagentFile(file, 'agent-a1.jsonl'), lines(block('msg_2', 20, 50, true)));
    await monitor!.poll();
    expect(monitor!.get(id)?.tokens).toEqual({ input: 120, output: 650, cacheWrite: 0, cacheRead: 0 });
  });

  // plan-session_usage/REQ-15: the same response in the main transcript and in a subagent file counts once
  it('counts a response repeated in two files once', async () => {
    const { id, file } = external();
    await append(file, lines(block('msg_shared', 40, 70, true)));
    await append(subagentFile(file, 'agent-a1.jsonl'), lines(block('msg_shared', 40, 70, true)));
    newMonitor();
    await monitor!.poll();
    expect(monitor!.get(id)?.tokens).toEqual({ input: 40, output: 70, cacheWrite: 0, cacheRead: 0 });
  });

  // plan-session_usage/REQ-14, REQ-20: a subagent file created after the first poll is read from its start, and a new subagent line shows at the next poll
  it('reads a new subagent file from its start and follows its new lines', async () => {
    const { id, file } = hosted();
    newMonitor();
    await append(file, lines(response(1_000)));
    await monitor!.poll();
    expect(monitor!.get(id)?.tokens).toEqual(tokens(1, 1_000));

    await append(subagentFile(file, 'agent-a1.jsonl'), lines(response(200, 0, 0, { sidechain: true }), response(30, 0, 0, { sidechain: true })));
    await monitor!.poll();
    expect(monitor!.get(id)).toEqual({ context: context(1_000), tokens: tokens(3, 1_230) });

    await append(subagentFile(file, 'agent-a1.jsonl'), lines(response(4, 0, 0, { sidechain: true })));
    await monitor!.poll();
    expect(monitor!.get(id)).toEqual({ context: context(1_000), tokens: tokens(4, 1_234) });
    expect(changesOf(id).map((usage) => usage?.tokens?.input)).toEqual([1_000, 1_230, 1_234]);
  });

  // plan-session_usage/REQ-16: a resumed session (same Claude Code session id, same file) counts the responses from before the resume
  it('counts the responses from before the resume', async () => {
    const before = hosted('idle', 'claude-resumed');
    await append(before.file, lines(userText('first'), response(5_000), response(6_000)));
    await append(subagentFile(before.file, 'agent-a1.jsonl'), lines(response(700, 0, 0, { sidechain: true })));
    exits.get(before.id)!();
    tracker.dismiss(before.id);

    nextId += 1;
    const resumed = `hosted-${nextId}`;
    tracker.track({ id: resumed, cwd: before.folder, onExit: () => {} });
    tracker.applyHookEvent(resumed, { hook_event_name: 'UserPromptSubmit', prompt: 'go on', session_id: 'claude-resumed' });
    newMonitor();
    await monitor!.poll();
    expect(monitor!.get(resumed)?.tokens).toEqual(tokens(3, 11_700));
    await append(before.file, lines(response(8_000)));
    await monitor!.poll();
    expect(monitor!.get(resumed)).toEqual({ context: context(8_000), tokens: tokens(4, 19_700) });
  });

  // plan-session_usage/REQ-17: a new Claude Code session id (/clear) drops the old tokens; the new count starts from zero
  it('starts again from zero after /clear', async () => {
    const { id, folder, file } = hosted('working', 'claude-before-clear');
    await append(file, lines(response(40_000), response(5_000)));
    await append(subagentFile(file, 'agent-a1.jsonl'), lines(response(900, 0, 0, { sidechain: true })));
    newMonitor();
    await monitor!.poll();
    expect(monitor!.get(id)?.tokens).toEqual(tokens(3, 45_900));

    tracker.applyHookEvent(id, { hook_event_name: 'UserPromptSubmit', prompt: '/clear', session_id: 'claude-after-clear' });
    await monitor!.poll();
    expect(monitor!.get(id), 'no tokens before the first new response').toBeUndefined();
    expect(changesOf(id).at(-1)).toBeUndefined();

    await append(file, lines(response(99_000)));
    await append(transcriptOf(folder, 'claude-after-clear'), lines(userText('hi'), response(2_000)));
    await monitor!.poll();
    expect(monitor!.get(id)).toEqual({ context: context(2_000), tokens: tokens(1, 2_000) });
  });

  // plan-session_usage/REQ-18: lines with no readable usage give no tokens, not zeros
  it('gives no tokens when no line carries a readable usage', async () => {
    const { id, file } = external();
    const noUsage = { type: 'assistant', uuid: 'u-1', message: { id: 'msg_x', model: 'claude-haiku-5-5', content: [] } };
    const synthetic = { type: 'assistant', uuid: 'u-2', message: { id: 'msg_y', model: '<synthetic>', usage: { input_tokens: 0, output_tokens: 0 } } };
    await append(file, lines(userText('hello'), noUsage, synthetic));
    await append(subagentFile(file, 'agent-a1.jsonl'), lines(userText('task'), { ...noUsage, isSidechain: true }));
    newMonitor();
    await monitor!.poll();
    expect(monitor!.get(id)).toBeUndefined();
    expect(changes).toEqual([]);
  });

  // plan-session_usage/REQ-19: an ended session keeps its tokens, subagent responses included
  it('keeps the tokens of an ended session', async () => {
    const { id, file } = hosted();
    newMonitor();
    await append(file, lines(response(3_000)));
    await append(subagentFile(file, 'agent-a1.jsonl'), lines(response(40, 0, 0, { sidechain: true })));
    await monitor!.poll();
    exits.get(id)!();
    await monitor!.poll();
    await monitor!.poll();
    expect(monitor!.get(id)).toEqual({ context: context(3_000), tokens: tokens(2, 3_040) });
  });

  // plan-session_usage/REQ-20: with the default interval a new subagent response shows within 2 seconds
  it('shows a new subagent response within 2 seconds with the default interval', async () => {
    const { id, file } = external();
    await append(file, lines(response(1_000)));
    newMonitor();
    monitor!.start();
    await waitFor(() => monitor!.get(id) !== undefined, 'first poll', 1_000);
    await append(subagentFile(file, 'agent-a1.jsonl'), lines(response(55, 0, 0, { sidechain: true })));
    const written = Date.now();
    await waitFor(() => monitor!.get(id)?.tokens?.input === 1_055, 'subagent response', 2_000);
    expect(Date.now() - written).toBeLessThan(2_000);
  });
});

describe('UsageMonitor, reading the subagent files', () => {
  // UsageMonitor spec: main transcript first, then the subagent files by name; each byte is read once
  it('reads the main transcript, then the subagent files by name, each line once', async () => {
    const recording = recordingReader();
    const { id, file } = hosted();
    const second = subagentFile(file, 'agent-b.jsonl');
    const first = subagentFile(file, 'agent-a.jsonl');
    await append(second, lines(response(20, 0, 0, { sidechain: true })));
    await append(first, lines(response(10, 0, 0, { sidechain: true })));
    await append(file, lines(response(1_000)));
    newMonitor({ reader: recording });
    await monitor!.poll();
    expect(recording.calls.map((call) => call.file)).toEqual([file, first, second]);

    await append(first, lines(response(30, 0, 0, { sidechain: true })));
    for (let n = 0; n < 3; n += 1) await monitor!.poll();
    expect(monitor!.get(id)?.tokens).toEqual(tokens(4, 1_060));
    for (const target of [file, first, second]) {
      const calls = recording.calls.filter((call) => call.file === target);
      expect(calls[0]?.from, `${target} read from its start`).toBe(0);
      for (let n = 1; n < calls.length; n += 1) expect(calls[n]!.from, `${target} goes on where it stopped`).toBe(calls[n - 1]!.to);
    }
  });

  // plan-session_usage/REQ-21, UsageMonitor spec: the subagent files share the byte budget of the main transcript; publication only at the end of every file
  it('shares maxBytesPerPoll between the main transcript and the subagent files, and publishes at the end of every file', async () => {
    const recording = recordingReader();
    const { id, file } = external();
    await append(file, lines(response(1_000)));
    const subagentLines = Array.from({ length: 30 }, (_, n) => response(n + 1, 0, 0, { sidechain: true }));
    await append(subagentFile(file, 'agent-a1.jsonl'), lines(...subagentLines));
    await append(subagentFile(file, 'agent-b2.jsonl'), lines(...subagentLines.slice(0, 5).map((line) => ({ ...line, uuid: `${line.uuid}-b`, message: { ...(line.message as Entry), id: `${(line.message as Entry).id}-b` } }))));
    newMonitor({ reader: recording, maxBytesPerPoll: 1_000 });

    let polls = 0;
    while (monitor!.get(id) === undefined) {
      const before = recording.calls.length;
      await monitor!.poll();
      polls += 1;
      const read = recording.calls.slice(before).reduce((sum, call) => sum + call.to - call.from, 0);
      expect(read, `bytes read at poll ${polls}`).toBeLessThanOrEqual(1_000);
      expect(polls, 'the reading ends').toBeLessThan(40);
    }
    expect(polls, 'over several polls').toBeGreaterThan(2);
    const all = 1_000 + (30 * 31) / 2 + 15;
    expect(monitor!.get(id)).toEqual({ context: context(1_000), tokens: tokens(36, all) });
    expect(changesOf(id)).toEqual([monitor!.get(id)]);
  });
});
