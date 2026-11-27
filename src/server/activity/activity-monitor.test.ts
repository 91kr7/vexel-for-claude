import { appendFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ExternalSessionChange, ExternalSessionSummary } from '../external/external-session-scanner.js';
import { TranscriptReader } from '../external/transcript-reader.js';
import { SessionStateTracker } from '../sessions/session-state-tracker.js';
import { snapshotTree, tempDir, waitFor } from '../test-support.js';
import { ActivityMonitor } from './activity-monitor.js';
import type { LiveActivity } from './live-activity.js';

type Line = Record<string, unknown>;

let claudeDir: string;
let reader: TranscriptReader;
let tracker: SessionStateTracker;
let scanner: FakeScanner;
let nextId = 0;
const monitors: ActivityMonitor[] = [];
const exits = new Map<string, () => void>();

class FakeScanner {
  readonly sessions = new Map<string, ExternalSessionSummary>();
  readonly #listeners = new Set<(change: ExternalSessionChange) => void>();
  list = () => [...this.sessions.values()];
  get = (id: string) => this.sessions.get(id);
  onChange = (listener: (change: ExternalSessionChange) => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };
  put(session: ExternalSessionSummary): void {
    this.sessions.set(session.id, session);
    for (const listener of this.#listeners) listener({ type: 'session', session });
  }
  remove(id: string): void {
    this.sessions.delete(id);
    for (const listener of this.#listeners) listener({ type: 'session-removed', id });
  }
}

beforeAll(async () => {
  claudeDir = await tempDir('ai-client-activity-monitor-');
});

afterAll(async () => {
  await rm(claudeDir, { recursive: true, force: true });
});

afterEach(() => {
  for (const monitor of monitors.splice(0)) monitor.stop();
});

function newSources() {
  reader = new TranscriptReader({ claudeDir });
  tracker = new SessionStateTracker();
  scanner = new FakeScanner();
}

function monitorOf(options: { intervalMs?: number; maxBytesPerPoll?: number; reader?: Pick<TranscriptReader, 'locate' | 'readEntriesFrom'> } = {}): ActivityMonitor {
  const monitor = new ActivityMonitor({ tracker, scanner, reader: options.reader ?? reader, ...options });
  monitors.push(monitor);
  return monitor;
}

const uniqueName = (prefix: string) => {
  nextId += 1;
  return `${prefix}-${nextId}-${Math.random().toString(36).slice(2, 8)}`;
};
const folderOf = (name: string) => `/work/${name}`;
const transcriptOf = (cwd: string, sessionId: string) => path.join(claudeDir, 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'), `${sessionId}.jsonl`);
const subagentFileOf = (cwd: string, sessionId: string, agentId: string) =>
  path.join(claudeDir, 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'), sessionId, 'subagents', `${agentId}.jsonl`);

async function append(file: string, ...lines: Line[]): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, lines.map((line) => `${JSON.stringify(line)}\n`).join(''));
}

async function writeMeta(subagentFile: string, meta: unknown): Promise<void> {
  await mkdir(path.dirname(subagentFile), { recursive: true });
  await writeFile(subagentFile.replace(/\.jsonl$/, '.meta.json'), typeof meta === 'string' ? meta : JSON.stringify(meta));
}

const time = (offsetSeconds: number) => new Date(Date.parse('2026-11-26T10:00:00.000Z') + offsetSeconds * 1000).toISOString();
const userSays = (text: string, timestamp?: string): Line => ({
  type: 'user',
  isSidechain: false,
  ...(timestamp && { timestamp }),
  message: { role: 'user', content: text },
});
const claudeSays = (text: string, timestamp?: string, sidechain = false): Line => ({
  type: 'assistant',
  isSidechain: sidechain,
  ...(timestamp && { timestamp }),
  message: { role: 'assistant', content: [{ type: 'text', text }] },
});
const subSays = (text: string, timestamp?: string) => claudeSays(text, timestamp, true);
const toolCall = (id: string, name: string, input: object, timestamp: string, sidechain = false): Line => ({
  type: 'assistant',
  isSidechain: sidechain,
  timestamp,
  message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] },
});
const toolResult = (id: string, timestamp: string, sidechain = false): Line => ({
  type: 'user',
  isSidechain: sidechain,
  timestamp,
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'done' }] },
});

interface Hosted {
  id: string;
  cwd: string;
  sessionId: string;
  transcript: string;
}

/** A hosted session working on a turn, with its Claude Code session id known to the tracker. */
function workingHosted(): Hosted {
  const id = uniqueName('hosted');
  const cwd = folderOf(id);
  const sessionId = uniqueName('sid');
  tracker.track({ id, cwd, onExit: (listener) => exits.set(id, listener) });
  tracker.applyHookEvent(id, { hook_event_name: 'UserPromptSubmit', prompt: 'Do the work', session_id: sessionId });
  return { id, cwd, sessionId, transcript: transcriptOf(cwd, sessionId) };
}

function external(state: ExternalSessionSummary['state']): ExternalSessionSummary & { transcript: string; cwd: string } {
  const id = uniqueName('ext');
  const session: ExternalSessionSummary = { id, folder: folderOf(id), label: id, state, lastActivity: time(0), external: true };
  scanner.put(session);
  return { ...session, cwd: session.folder, transcript: transcriptOf(session.folder, id) };
}

function recordChanges(monitor: ActivityMonitor): [string, LiveActivity | undefined][] {
  const changes: [string, LiveActivity | undefined][] = [];
  monitor.onChange((id, activity) => changes.push([id, activity]));
  return changes;
}

describe('ActivityMonitor, reading', () => {
  // plan-session_activity/REQ-2: a hosted working session gets its latest text after a read
  it('gives the latest text of a hosted working session after a poll', async () => {
    newSources();
    const session = workingHosted();
    await append(session.transcript, userSays('Read the config', time(0)), claudeSays('I am **reading** the `config` files', time(1)));
    const monitor = monitorOf();
    expect(monitor.get(session.id), 'no value before the first read').toBeUndefined();
    await monitor.poll();
    expect(monitor.get(session.id)).toEqual({ atWork: true, latestText: { text: 'I am reading the config files', at: time(1) }, lastEventAt: time(1), waitingFor: 'response' });
  });

  // plan-session_activity/REQ-2: an external session, located by its id
  it('gives the latest text of an external working session', async () => {
    newSources();
    const session = external('working');
    await append(session.transcript, userSays('Explain', time(0)), claudeSays('The module has three parts', time(2)));
    const monitor = monitorOf();
    await monitor.poll();
    expect(monitor.get(session.id)).toEqual({ atWork: true, latestText: { text: 'The module has three parts', at: time(2) }, lastEventAt: time(2), waitingFor: 'response' });
  });

  // activity-monitor spec: a session added after the construction is followed too
  it('follows the sessions added after its construction', async () => {
    newSources();
    const monitor = monitorOf();
    const hosted = workingHosted();
    const ext = external('working');
    await append(hosted.transcript, userSays('Go', time(0)), claudeSays('Hosted text', time(1)));
    await append(ext.transcript, userSays('Go', time(0)), claudeSays('External text', time(1)));
    await monitor.poll();
    expect(monitor.get(hosted.id)?.latestText?.text).toBe('Hosted text');
    expect(monitor.get(ext.id)?.latestText?.text).toBe('External text');
  });

  // activity-monitor spec: no file yet → no value; the next poll tries again
  it('has no value while the transcript does not exist, and reads it once it appears', async () => {
    newSources();
    const session = workingHosted();
    const monitor = monitorOf();
    await monitor.poll();
    expect(monitor.get(session.id)).toBeUndefined();
    await append(session.transcript, userSays('Go', time(0)), claudeSays('Now it exists', time(1)));
    await monitor.poll();
    expect(monitor.get(session.id)?.latestText?.text).toBe('Now it exists');
  });

  // activity-monitor spec: a hosted session with no Claude Code session id has no transcript
  it('has no value for a hosted session with no Claude Code session id', async () => {
    newSources();
    const id = uniqueName('hosted');
    tracker.track({ id, cwd: folderOf(id), onExit: () => {} });
    tracker.applyHookEvent(id, { hook_event_name: 'UserPromptSubmit', prompt: 'Go' });
    const monitor = monitorOf();
    await monitor.poll();
    expect(monitor.get(id)).toBeUndefined();
    expect(monitor.get('unknown-id')).toBeUndefined();
  });

  // plan-session_activity/REQ-12: each poll reads only the new complete lines; a partial line waits for its end
  it('reads the new lines at each poll, and a partial last line once it is complete', async () => {
    newSources();
    const session = workingHosted();
    await append(session.transcript, userSays('Go', time(0)), claudeSays('First text', time(1)));
    const monitor = monitorOf();
    await monitor.poll();
    const partial = JSON.stringify(claudeSays('Second text', time(2)));
    await appendFile(session.transcript, partial.slice(0, 20));
    await monitor.poll();
    expect(monitor.get(session.id)?.latestText?.text).toBe('First text');
    await appendFile(session.transcript, `${partial.slice(20)}\n`);
    await monitor.poll();
    expect(monitor.get(session.id)?.latestText?.text).toBe('Second text');
  });

  // plan-session_activity/REQ-3, REQ-4: the text of a running subagent that wrote last, with its type from the metadata
  it('gives the text of a running subagent that wrote after the main conversation, with its type', async () => {
    newSources();
    const session = external('working');
    await append(session.transcript, userSays('Implement the batch', time(0)), claudeSays('Starting the developer', time(1)));
    const sub = subagentFileOf(session.cwd, session.id, 'agent-a1');
    await append(sub, { ...userSays('Implement', time(2)), isSidechain: true }, subSays('Overwriting the whole CommonServiceImpl class', time(3)));
    await writeMeta(sub, { agentType: 'sdd-developer', description: 'Implement batch', toolUseId: 'toolu_1' });
    const monitor = monitorOf();
    await monitor.poll();
    expect(monitor.get(session.id)).toEqual({
      atWork: true,
      latestText: { text: 'Overwriting the whole CommonServiceImpl class', subagentType: 'sdd-developer', at: time(3) },
      lastEventAt: time(3),
      waitingFor: 'response',
    });
    await append(session.transcript, claudeSays('Back in the main conversation', time(4)));
    await monitor.poll();
    expect(monitor.get(session.id)?.latestText).toEqual({ text: 'Back in the main conversation', at: time(4) });
  });

  // plan-session_activity/REQ-13: no metadata → the text with no type
  it('gives a subagent text with no type when it has no metadata', async () => {
    newSources();
    const session = external('working');
    await append(session.transcript, userSays('Go', time(0)));
    await append(subagentFileOf(session.cwd, session.id, 'agent-b1'), subSays('Untyped text'));
    const monitor = monitorOf();
    await monitor.poll();
    expect(monitor.get(session.id)).toEqual({ atWork: true, latestText: { text: 'Untyped text' }, lastEventAt: expect.any(String), waitingFor: 'response' });
  });

  // activity-monitor spec: a metadata read with no field keeps the metadata known before
  it('keeps the known subagent type when a later metadata read gives no field', async () => {
    newSources();
    const session = external('working');
    await append(session.transcript, userSays('Go', time(0)));
    const sub = subagentFileOf(session.cwd, session.id, 'agent-c1');
    await append(sub, subSays('Typed text', time(1)));
    await writeMeta(sub, { agentType: 'Explore' });
    const monitor = monitorOf();
    await monitor.poll();
    expect(monitor.get(session.id)?.latestText?.subagentType).toBe('Explore');
    await writeMeta(sub, '{"agentType": "Exp');
    await append(sub, subSays('Next typed text', time(2)));
    await monitor.poll();
    expect(monitor.get(session.id)?.latestText).toEqual({ text: 'Next typed text', subagentType: 'Explore', at: time(2) });
  });

  // plan-session_activity/REQ-1: an idle session with a running background subagent stays at work, until the subagent finishes
  it('keeps an idle session at work while a subagent runs, and not after it finishes', async () => {
    newSources();
    const session = workingHosted();
    await append(session.transcript, userSays('Start a background agent', time(0)), claudeSays('The agent runs in the background', time(1)));
    const sub = subagentFileOf(session.cwd, session.sessionId, 'agent-bg');
    await append(sub, subSays('Scanning the repository', time(2)));
    await writeMeta(sub, { agentType: 'general-purpose' });
    const monitor = monitorOf();
    tracker.applyHookEvent(session.id, { hook_event_name: 'Stop' });
    await monitor.poll();
    expect(tracker.get(session.id)?.state).toBe('idle');
    expect(monitor.get(session.id)).toEqual({
      atWork: true,
      latestText: { text: 'Scanning the repository', subagentType: 'general-purpose', at: time(2) },
      lastEventAt: time(2),
      waitingFor: 'response',
    });
    await writeMeta(sub, { agentType: 'general-purpose', finished: true });
    await monitor.poll();
    expect(monitor.get(session.id)).toEqual({ atWork: false });
  });

  // plan-session_activity/REQ-1, REQ-11: a subagent killed by the user (task notification) stops keeping the session at work
  it('ends the work of an idle session when the main transcript reports its subagent killed', async () => {
    newSources();
    const session = external('idle');
    await append(session.transcript, userSays('Go', time(0)));
    await append(subagentFileOf(session.cwd, session.id, 'agent-k9'), subSays('Long work', time(1)));
    const monitor = monitorOf();
    await monitor.poll();
    expect(monitor.get(session.id)?.atWork).toBe(true);
    await append(session.transcript, {
      type: 'user',
      isSidechain: false,
      origin: { kind: 'task-notification' },
      promptSource: 'system',
      timestamp: time(5),
      message: { role: 'user', content: '<task-notification>\n<task-id>k9</task-id>\n<status>killed</status>\n</task-notification>' },
    });
    await monitor.poll();
    expect(monitor.get(session.id)).toEqual({ atWork: false });
  });

  // plan-session_activity/REQ-14: at most maxBytesPerPoll bytes per session per poll; the value comes once every file is read
  it('reads at most maxBytesPerPoll bytes per poll, and gives the value once it reached the end of every file', async () => {
    newSources();
    const session = external('working');
    const lines: Line[] = [userSays('Long run', time(0))];
    for (let step = 1; step <= 200; step += 1) lines.push(claudeSays(`Main step ${step}`, time(step)));
    await append(session.transcript, ...lines);
    const subLines: Line[] = [];
    for (let step = 1; step <= 200; step += 1) subLines.push(subSays(`Sub step ${step}`, time(1000 + step)));
    await append(subagentFileOf(session.cwd, session.id, 'agent-big'), ...subLines);
    const monitor = monitorOf({ maxBytesPerPoll: 4096 });
    let polls = 0;
    while (monitor.get(session.id) === undefined && polls < 100) {
      await monitor.poll();
      polls += 1;
    }
    expect(polls, 'several polls for about 40 KB at 4 KB per poll').toBeGreaterThanOrEqual(8);
    expect(monitor.get(session.id)?.latestText?.text).toBe('Sub step 200');
  });

  // activity-monitor spec: a failed read changes nothing, and the next poll runs as usual
  it('survives a failed read', async () => {
    newSources();
    const session = external('working');
    await append(session.transcript, userSays('Go', time(0)), claudeSays('Before the failure', time(1)));
    let fail = false;
    const flaky: Pick<TranscriptReader, 'locate' | 'readEntriesFrom'> = {
      locate: (cwd, id) => reader.locate(cwd, id),
      readEntriesFrom: (file, offset, maxBytes) => (fail ? Promise.reject(new Error('EIO')) : reader.readEntriesFrom(file, offset, maxBytes)),
    };
    const monitor = monitorOf({ reader: flaky });
    await monitor.poll();
    expect(monitor.get(session.id)?.latestText?.text).toBe('Before the failure');
    fail = true;
    await append(session.transcript, claudeSays('After the failure', time(2)));
    await expect(monitor.poll()).resolves.toBeUndefined();
    expect(monitor.get(session.id)?.latestText?.text).toBe('Before the failure');
    fail = false;
    await monitor.poll();
    expect(monitor.get(session.id)?.latestText?.text).toBe('After the failure');
  });

  // activity-monitor spec: it never writes under the Claude Code folder
  it('writes nothing under the Claude Code folder', async () => {
    newSources();
    const session = external('working');
    await append(session.transcript, userSays('Go', time(0)), claudeSays('Text', time(1)));
    const sub = subagentFileOf(session.cwd, session.id, 'agent-ro');
    await append(sub, subSays('Sub text', time(2)));
    await writeMeta(sub, { agentType: 'Explore', finished: true });
    const before = await snapshotTree(claudeDir);
    const monitor = monitorOf();
    await monitor.poll();
    await monitor.poll();
    expect(await snapshotTree(claudeDir)).toEqual(before);
  });
});

describe('ActivityMonitor, changes', () => {
  // activity-monitor spec: onChange after each change of get(id), never when the value stays the same
  it('notifies each change once, and nothing when the value stays the same', async () => {
    newSources();
    const session = external('working');
    await append(session.transcript, userSays('Go', time(0)), claudeSays('One', time(1)));
    const monitor = monitorOf();
    const changes = recordChanges(monitor);
    await monitor.poll();
    const one = { atWork: true, latestText: { text: 'One', at: time(1) }, waitingFor: 'response' };
    expect(changes).toEqual([[session.id, { ...one, lastEventAt: time(1) }]]);
    await monitor.poll();
    expect(changes, 'nothing new, no change').toHaveLength(1);
    await append(session.transcript, { type: 'assistant', isSidechain: false, timestamp: time(2), message: { role: 'assistant', content: [{ type: 'thinking', thinking: 'Hmm' }] } });
    await monitor.poll();
    expect(changes, 'thinking keeps the text and moves the last activity').toEqual([
      [session.id, { ...one, lastEventAt: time(1) }],
      [session.id, { ...one, lastEventAt: time(2) }],
    ]);
    await append(session.transcript, claudeSays('Two', time(3)));
    await monitor.poll();
    expect(changes.at(-1)).toEqual([session.id, { atWork: true, latestText: { text: 'Two', at: time(3) }, lastEventAt: time(3), waitingFor: 'response' }]);
    expect(changes).toHaveLength(3);
  });

  // plan-session_activity/REQ-17, REQ-22 and activity-monitor spec: a new activity with no new text is a change of lastEventAt
  it('notifies a change when a subagent writes a tool result, with the text unchanged', async () => {
    newSources();
    const session = external('working');
    await append(session.transcript, userSays('Go', time(0)), claudeSays('Main text', time(1)));
    const sub = subagentFileOf(session.cwd, session.id, 'agent-r1');
    await append(sub, toolCall('s1', 'Bash', { command: 'mvn test' }, time(2), true));
    const monitor = monitorOf();
    await monitor.poll();
    const changes = recordChanges(monitor);
    await append(sub, toolResult('s1', time(3), true));
    await monitor.poll();
    expect(changes).toEqual([[session.id, { atWork: true, latestText: { text: 'Main text', at: time(1) }, lastEventAt: time(3), waitingFor: 'response' }]]);
  });

  // plan-session_activity/REQ-18 and activity-monitor spec: a call that opens or closes changes waitingFor
  it('notifies the running tool when a call opens, and the response when its result arrives', async () => {
    newSources();
    const session = external('working');
    await append(session.transcript, userSays('Build it', time(0)));
    const monitor = monitorOf();
    await monitor.poll();
    expect(monitor.get(session.id)?.waitingFor).toBe('response');
    const changes = recordChanges(monitor);
    await append(session.transcript, toolCall('t1', 'Bash', { command: 'npm run build' }, time(1)));
    await monitor.poll();
    expect(changes).toEqual([[session.id, { atWork: true, lastEventAt: time(1), waitingFor: { name: 'Bash', argument: 'npm run build', others: 0 } }]]);
    await append(session.transcript, toolResult('t1', time(2)));
    await monitor.poll();
    expect(changes.at(-1)).toEqual([session.id, { atWork: true, lastEventAt: time(2), waitingFor: 'response' }]);
    expect(changes).toHaveLength(2);
  });

  // activity-monitor spec: the unsubscribe function stops the notifications
  it('stops notifying after unsubscribe', async () => {
    newSources();
    const session = external('working');
    await append(session.transcript, userSays('Go', time(0)), claudeSays('One', time(1)));
    const monitor = monitorOf();
    const seen: string[] = [];
    const unsubscribe = monitor.onChange((id) => seen.push(id));
    unsubscribe();
    await monitor.poll();
    expect(seen).toEqual([]);
  });

  // plan-session_activity/REQ-11, REQ-12: a session that ends loses atWork at once, with no read
  it('drops atWork at once when a hosted session ends', async () => {
    newSources();
    const session = workingHosted();
    await append(session.transcript, userSays('Go', time(0)), claudeSays('Working hard', time(1)));
    const monitor = monitorOf();
    await monitor.poll();
    const changes = recordChanges(monitor);
    exits.get(session.id)?.();
    expect(tracker.get(session.id)?.state).toBe('ended');
    expect(monitor.get(session.id)).toEqual({ atWork: false });
    expect(changes).toEqual([[session.id, { atWork: false }]]);
  });

  // plan-session_activity/REQ-11: a session that needs input with no running subagent is not at work, at once
  it('drops atWork at once when a hosted session needs input or goes idle', async () => {
    newSources();
    const asking = workingHosted();
    const idle = workingHosted();
    await append(asking.transcript, userSays('Go', time(0)), claudeSays('Text', time(1)));
    await append(idle.transcript, userSays('Go', time(0)), claudeSays('Text', time(1)));
    const monitor = monitorOf();
    await monitor.poll();
    tracker.applyHookEvent(asking.id, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
    tracker.applyHookEvent(idle.id, { hook_event_name: 'Stop' });
    expect(monitor.get(asking.id)).toEqual({ atWork: false });
    expect(monitor.get(idle.id)).toEqual({ atWork: false });
  });

  // plan-session_activity/REQ-11, REQ-12: an external session that ends loses atWork at once, also with a running subagent
  it('drops atWork at once when an external session ends, its subagents included', async () => {
    newSources();
    const session = external('working');
    await append(session.transcript, userSays('Go', time(0)));
    await append(subagentFileOf(session.cwd, session.id, 'agent-e1'), subSays('Subagent text', time(1)));
    const monitor = monitorOf();
    await monitor.poll();
    expect(monitor.get(session.id)?.latestText?.text).toBe('Subagent text');
    scanner.put({ ...scanner.sessions.get(session.id)!, state: 'ended' });
    expect(monitor.get(session.id)).toEqual({ atWork: false });
  });

  // plan-session_activity/REQ-10 and the monitor exception: a change to working from idle waits for the next read
  it('shows no text of the previous turn when an idle session starts a new turn', async () => {
    newSources();
    const session = workingHosted();
    await append(session.transcript, userSays('First task', time(0)), claudeSays('First task done', time(1)));
    const monitor = monitorOf();
    await monitor.poll();
    tracker.applyHookEvent(session.id, { hook_event_name: 'Stop' });
    expect(monitor.get(session.id)).toEqual({ atWork: false });
    const changes = recordChanges(monitor);
    tracker.applyHookEvent(session.id, { hook_event_name: 'UserPromptSubmit', prompt: 'Second task', session_id: session.sessionId });
    expect(changes.filter(([, activity]) => activity?.latestText?.text === 'First task done'), 'never the old text').toEqual([]);
    await append(session.transcript, userSays('Second task', time(10)));
    await monitor.poll();
    expect(monitor.get(session.id)).toEqual({ atWork: true, lastEventAt: time(10), waitingFor: 'response' });
    await append(session.transcript, claudeSays('Second task started', time(11)));
    await monitor.poll();
    expect(monitor.get(session.id)?.latestText?.text).toBe('Second task started');
    expect(changes.some(([, activity]) => activity?.latestText?.text === 'First task done')).toBe(false);
  });

  // activity-monitor spec: a removed session has no value, and the removal gives no onChange call
  it('drops the value of a removed session with no notification', async () => {
    newSources();
    const hosted = workingHosted();
    const ext = external('working');
    await append(hosted.transcript, userSays('Go', time(0)), claudeSays('Hosted', time(1)));
    await append(ext.transcript, userSays('Go', time(0)), claudeSays('External', time(1)));
    const monitor = monitorOf();
    await monitor.poll();
    exits.get(hosted.id)?.();
    const changes = recordChanges(monitor);
    expect(tracker.dismiss(hosted.id)).toBe(true);
    scanner.remove(ext.id);
    expect(monitor.get(hosted.id)).toBeUndefined();
    expect(monitor.get(ext.id)).toBeUndefined();
    await monitor.poll();
    expect(monitor.get(hosted.id)).toBeUndefined();
    expect(monitor.get(ext.id)).toBeUndefined();
    expect(changes).toEqual([]);
  });

  // activity-monitor spec: a new Claude Code session id drops the old transcript and its model, with a change
  it('drops the value when the Claude Code session id of a hosted session changes, then reads the new transcript', async () => {
    newSources();
    const session = workingHosted();
    await append(session.transcript, userSays('Go', time(0)), claudeSays('Old transcript text', time(1)));
    const monitor = monitorOf();
    await monitor.poll();
    expect(monitor.get(session.id)?.latestText?.text).toBe('Old transcript text');
    const changes = recordChanges(monitor);
    const newSessionId = uniqueName('sid');
    tracker.applyHookEvent(session.id, { hook_event_name: 'UserPromptSubmit', prompt: 'Go on', session_id: newSessionId });
    await monitor.poll();
    expect(monitor.get(session.id), 'the new transcript does not exist yet').toBeUndefined();
    expect(changes.at(-1)).toEqual([session.id, undefined]);
    await append(transcriptOf(session.cwd, newSessionId), userSays('Go on', time(5)), claudeSays('New transcript text', time(6)));
    await monitor.poll();
    expect(monitor.get(session.id)?.latestText?.text).toBe('New transcript text');
  });
});

describe('ActivityMonitor, settled sessions and timing', () => {
  function countingReader() {
    const calls: string[] = [];
    const counting: Pick<TranscriptReader, 'locate' | 'readEntriesFrom'> = {
      locate: (cwd, id) => reader.locate(cwd, id),
      readEntriesFrom: (file, offset, maxBytes) => {
        calls.push(file);
        return reader.readEntriesFrom(file, offset, maxBytes);
      },
    };
    return { calls, counting };
  }

  // activity-monitor spec: an ended session read to the end is settled; a state change reads it again
  it('stops reading an ended session read to the end, and reads it again after a state change', async () => {
    newSources();
    const session = external('ended');
    await append(session.transcript, userSays('Go', time(0)), claudeSays('Last words', time(1)));
    const { calls, counting } = countingReader();
    const monitor = monitorOf({ reader: counting });
    await monitor.poll();
    expect(monitor.get(session.id)).toEqual({ atWork: false });
    await monitor.poll();
    const settledAt = calls.length;
    await monitor.poll();
    await monitor.poll();
    expect(calls.length, 'no read of a settled session').toBe(settledAt);
    scanner.put({ ...scanner.sessions.get(session.id)!, state: 'working' });
    await append(session.transcript, userSays('Resumed', time(10)), claudeSays('Back to work', time(11)));
    await monitor.poll();
    expect(calls.length).toBeGreaterThan(settledAt);
    expect(monitor.get(session.id)?.latestText?.text).toBe('Back to work');
  });

  // plan-session_activity/REQ-12: started, the monitor shows a new text within 2 seconds of its line
  it('shows a new text within 2 seconds once started, and stops reading after stop()', async () => {
    newSources();
    const session = external('working');
    await append(session.transcript, userSays('Go', time(0)), claudeSays('First', time(1)));
    const { calls, counting } = countingReader();
    const monitor = monitorOf({ reader: counting });
    monitor.start();
    monitor.start();
    await waitFor(() => monitor.get(session.id)?.latestText?.text === 'First', 'first text', 2000);
    await append(session.transcript, claudeSays('Second', time(2)));
    await waitFor(() => monitor.get(session.id)?.latestText?.text === 'Second', 'second text within 2 s', 2000);
    monitor.stop();
    await new Promise((resolve) => setTimeout(resolve, 200));
    const stoppedAt = calls.length;
    await append(session.transcript, claudeSays('Third', time(3)));
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(calls.length, 'no read after stop').toBe(stoppedAt);
    expect(monitor.get(session.id)?.latestText?.text).toBe('Second');
  });

  // activity-monitor spec: polls run intervalMs after the end of the previous one; a second start() adds no loop
  it('polls again every intervalMs, with one loop for two start() calls', async () => {
    newSources();
    const session = external('working');
    await append(session.transcript, userSays('Go', time(0)));
    const { calls, counting } = countingReader();
    const single = monitorOf({ reader: counting, intervalMs: 100 });
    single.start();
    await new Promise((resolve) => setTimeout(resolve, 1050));
    single.stop();
    const once = calls.length;
    expect(once, 'several polls in about 1 s at 100 ms').toBeGreaterThanOrEqual(3);

    const second = countingReader();
    const twice = monitorOf({ reader: second.counting, intervalMs: 100 });
    twice.start();
    twice.start();
    await new Promise((resolve) => setTimeout(resolve, 1050));
    twice.stop();
    expect(second.calls.length, 'a second start() does not double the reads').toBeLessThanOrEqual(once * 1.5 + 2);
  });
});

describe('ActivityMonitor, turn tree', () => {
  const agentCall = (id: string, description: string): object => ({ type: 'tool_use', id, name: 'Agent', input: { description, prompt: 'Do it', subagent_type: 'sdd-developer' } });
  const calls = (blocks: object[], timestamp: string): Line => ({ type: 'assistant', isSidechain: false, timestamp, message: { role: 'assistant', content: blocks } });

  function recordTurnChanges(monitor: ActivityMonitor) {
    const changes: [string, unknown][] = [];
    monitor.onTurnChange((id, change) => changes.push([id, change]));
    return changes;
  }

  // plan-subagent_panel/REQ-1, REQ-20: undefined for an unknown id, noTurn() before the first read and with no transcript, then the tree with no steps
  it('gives no tree for an unknown id, noTurn() before the first read, then the tree with no steps', async () => {
    newSources();
    const session = workingHosted();
    const empty = external('working');
    await append(session.transcript, userSays('Check the repo', time(0)), claudeSays('Looking', time(1)), toolCall('t1', 'Bash', { command: 'git status' }, time(2)));
    const monitor = monitorOf();
    expect(monitor.turnOf('unknown-id')).toBeUndefined();
    expect(monitor.turnOf(session.id)).toEqual({ number: 0, groups: [], subagents: [] });
    await monitor.poll();
    expect(monitor.turnOf(empty.id)).toEqual({ number: 0, groups: [], subagents: [] });
    expect(monitor.turnOf(session.id)).toEqual({ number: 1, groups: [], subagents: [] });
  });

  // plan-session_activity/REQ-32, REQ-37: subagents started in one message form a group, with the model of their metadata file
  it('shows the subagents of one message as one group, with type, description and the model of the metadata file', async () => {
    newSources();
    const session = external('working');
    await append(session.transcript, userSays('Go', time(0)), calls([agentCall('a1', 'First task'), agentCall('a2', 'Second task')], time(1)));
    const first = subagentFileOf(session.cwd, session.id, 'agent-a1');
    const second = subagentFileOf(session.cwd, session.id, 'agent-a2');
    await append(first, userSays('Task', time(2)), subSays('Working on it', time(3)));
    await append(second, userSays('Task', time(2)));
    await writeMeta(first, { agentType: 'sdd-developer', description: 'First task', toolUseId: 'a1', pickedEffortModel: 'claude-opus-5-5' });
    await writeMeta(second, { agentType: 'sdd-tester', description: 'Second task', toolUseId: 'a2' });
    const monitor = monitorOf();
    await monitor.poll();
    const tree = monitor.turnOf(session.id);
    expect(tree?.groups).toEqual([{ subagents: ['agent-a1', 'agent-a2'] }]);
    expect(tree?.subagents).toEqual([
      { id: 'agent-a1', type: 'sdd-developer', description: 'First task', model: 'claude-opus-5-5', state: 'running', startedAt: time(2), latestText: 'Working on it', groups: [] },
      { id: 'agent-a2', type: 'sdd-tester', description: 'Second task', state: 'running', startedAt: time(2), groups: [] },
    ]);
  });

  // plan-session_activity/REQ-43, plan-subagent_panel/REQ-1, REQ-14: the whole tree first; no call for the main conversation; only the changed parts; the whole tree at a new turn, running subagents kept
  it('notifies the whole tree first, nothing for the main conversation, then only the changed parts, and the whole tree at a new turn', async () => {
    newSources();
    const session = external('working');
    await append(session.transcript, userSays('Go', time(0)), claudeSays('First', time(1)));
    const monitor = monitorOf();
    const changes = recordTurnChanges(monitor);
    await monitor.poll();
    expect(changes).toEqual([[session.id, { type: 'turn', turn: { number: 1, groups: [], subagents: [] } }]]);
    await monitor.poll();
    expect(changes, 'no call when nothing changed').toHaveLength(1);
    await append(session.transcript, toolCall('t1', 'Bash', { command: 'ls' }, time(2)));
    await monitor.poll();
    await append(session.transcript, toolResult('t1', time(3)), claudeSays('Listed', time(4)));
    await monitor.poll();
    expect(changes, 'no call for a tool call or a text of the main conversation').toHaveLength(1);
    await append(session.transcript, calls([agentCall('a1', 'Task')], time(5)));
    const file = subagentFileOf(session.cwd, session.id, 'agent-a1');
    await append(file, userSays('Task', time(6)));
    await writeMeta(file, { agentType: 'Explore', toolUseId: 'a1' });
    await monitor.poll();
    expect(changes.at(-1)).toEqual([
      session.id,
      { type: 'update', groups: [{ subagents: ['agent-a1'] }], subagents: [{ id: 'agent-a1', type: 'Explore', state: 'running', startedAt: time(6), groups: [] }] },
    ]);
    await append(session.transcript, userSays('Next', time(7)));
    await monitor.poll();
    expect(changes.at(-1)).toEqual([session.id, { type: 'turn', turn: expect.objectContaining({ number: 2, groups: [{ subagents: ['agent-a1'] }] }) }]);
  });

  // plan-subagent_panel/REQ-15: the tree has no turn state, so a session that needs input or goes idle sends no change
  it('sends no change when the session needs input or goes idle', async () => {
    newSources();
    const session = workingHosted();
    await append(session.transcript, userSays('Go', time(0)), claudeSays('Text', time(1)));
    const monitor = monitorOf();
    await monitor.poll();
    const changes = recordTurnChanges(monitor);
    tracker.applyHookEvent(session.id, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
    tracker.applyHookEvent(session.id, { hook_event_name: 'Stop' });
    await monitor.poll();
    expect(changes).toEqual([]);
    expect(monitor.turnOf(session.id)).toEqual({ number: 1, groups: [], subagents: [] });
  });

  // plan-subagent_panel/REQ-16, activity-monitor spec: the subagents of a session that ends leave the tree at once
  it('drops a running subagent from the tree at once when its session ends', async () => {
    newSources();
    const session = workingHosted();
    await append(session.transcript, userSays('Go', time(0)), calls([agentCall('a1', 'Task')], time(1)));
    const file = subagentFileOf(session.cwd, session.sessionId, 'agent-a1');
    await append(file, userSays('Task', time(2)), subSays('Working', time(3)));
    await writeMeta(file, { agentType: 'Explore', toolUseId: 'a1' });
    const monitor = monitorOf();
    await monitor.poll();
    expect(monitor.turnOf(session.id)?.subagents[0]?.state).toBe('running');
    const changes = recordTurnChanges(monitor);
    exits.get(session.id)?.();
    expect(monitor.turnOf(session.id)).toEqual({ number: 1, groups: [], subagents: [] });
    expect(changes).toEqual([[session.id, { type: 'update', groups: [] }]]);
  });

  // activity-monitor spec: turnOf and each listener get their own copy
  it('gives a copy of the tree to turnOf and to each listener', async () => {
    newSources();
    const session = external('working');
    await append(session.transcript, userSays('Go', time(0)), calls([agentCall('a1', 'Task')], time(1)));
    const file = subagentFileOf(session.cwd, session.id, 'agent-a1');
    await append(file, userSays('Task', time(2)));
    await writeMeta(file, { agentType: 'Explore', toolUseId: 'a1' });
    const monitor = monitorOf();
    const received: unknown[] = [];
    monitor.onTurnChange((_id, change) => {
      if (change.type === 'turn') change.turn.subagents.length = 0;
    });
    monitor.onTurnChange((_id, change) => received.push(change.type === 'turn' ? change.turn.subagents.length : undefined));
    await monitor.poll();
    expect(received).toEqual([1]);
    const copy = monitor.turnOf(session.id)!;
    copy.subagents.length = 0;
    copy.groups.length = 0;
    expect(monitor.turnOf(session.id)).toMatchObject({ groups: [{ subagents: ['agent-a1'] }], subagents: [{ id: 'agent-a1' }] });
  });

  // activity-monitor spec: a removed session has no tree and gives no call; an unsubscribed listener gets no call
  it('drops the tree of a removed session with no call, and stops calling after unsubscribe', async () => {
    newSources();
    const removed = external('working');
    const kept = external('working');
    await append(removed.transcript, userSays('Go', time(0)), claudeSays('Text', time(1)));
    await append(kept.transcript, userSays('Go', time(0)), claudeSays('Text', time(1)));
    const monitor = monitorOf();
    await monitor.poll();
    const changes = recordTurnChanges(monitor);
    const unsubscribed: unknown[] = [];
    const unsubscribe = monitor.onTurnChange((id, change) => unsubscribed.push([id, change]));
    unsubscribe();
    scanner.remove(removed.id);
    expect(monitor.turnOf(removed.id)).toBeUndefined();
    await append(kept.transcript, userSays('Next', time(2)));
    await monitor.poll();
    expect(changes.map(([id]) => id)).toEqual([kept.id]);
    expect(unsubscribed).toEqual([]);
  });

  // activity-monitor spec: a new Claude Code session id sends noTurn() whole
  it('sends noTurn() as a whole tree when the Claude Code session id of a hosted session changes', async () => {
    newSources();
    const session = workingHosted();
    await append(session.transcript, userSays('Go', time(0)), claudeSays('Old transcript text', time(1)));
    const monitor = monitorOf();
    await monitor.poll();
    const changes = recordTurnChanges(monitor);
    tracker.applyHookEvent(session.id, { hook_event_name: 'UserPromptSubmit', prompt: 'Go on', session_id: uniqueName('sid') });
    await monitor.poll();
    expect(changes.at(-1)).toEqual([session.id, { type: 'turn', turn: { number: 0, groups: [], subagents: [] } }]);
    expect(monitor.turnOf(session.id)?.number).toBe(0);
  });
});
