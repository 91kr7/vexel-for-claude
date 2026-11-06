import { appendFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import fastifyWebsocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ExternalSessionChange, ExternalSessionSummary } from '../external/external-session-scanner.js';
import { TranscriptReader } from '../external/transcript-reader.js';
import { type WsClient, connectWs, tempDir, waitFor } from '../test-support.js';
import { registerSessionEventsRoute } from './session-events-route.js';
import { registerSessionListRoute } from './session-list-route.js';
import { SessionStateTracker } from './session-state-tracker.js';
import { UsageMonitor } from './usage-monitor.js';

// REQ tests of plan-session_usage, batch context-occupancy, at the REST API: real monitor, reader and routes on a temp Claude Code folder.

type Entry = Record<string, unknown>;

let nextKey = 0;
const response = (input: number, cacheWrite: number, cacheRead: number, sidechain = false): Entry => {
  nextKey += 1;
  return {
    type: 'assistant',
    uuid: `line-${nextKey}`,
    isSidechain: sidechain,
    message: {
      id: `msg_${nextKey}`,
      model: 'claude-haiku-5-5',
      usage: { input_tokens: input, output_tokens: 1_234, cache_creation_input_tokens: cacheWrite, cache_read_input_tokens: cacheRead },
    },
  };
};
const lines = (...entries: Entry[]) => entries.map((entry) => `${JSON.stringify(entry)}\n`).join('');

const external: ExternalSessionSummary = {
  id: '0a1b2c3d-0000-4000-8000-000000000001',
  folder: '/projects/outside',
  label: 'outside',
  state: 'idle',
  lastActivity: '2026-11-06T09:00:00.000Z',
  external: true,
};
const externalListeners: ((change: ExternalSessionChange) => void)[] = [];
const scanner = {
  list: () => [external],
  get: (id: string) => (id === external.id ? external : undefined),
  onChange: (listener: (change: ExternalSessionChange) => void) => {
    externalListeners.push(listener);
    return () => {};
  },
};

let claudeDir: string;
let app: FastifyInstance;
let tracker: SessionStateTracker;
let monitor: UsageMonitor;
let exitHosted: () => void;
let client: WsClient | undefined;

const transcriptOf = (folder: string, claudeSessionId: string) =>
  path.join(claudeDir, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'), `${claudeSessionId}.jsonl`);

async function append(file: string, text: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, text);
}

async function sessions(): Promise<Record<string, Record<string, unknown>>> {
  const reply = await app.inject({ method: 'GET', url: '/api/sessions' });
  expect(reply.statusCode).toBe(200);
  return Object.fromEntries((reply.json() as Record<string, unknown>[]).map((session) => [session.id as string, session]));
}

beforeEach(async () => {
  claudeDir = await tempDir('ai-client-usage-api-');
  tracker = new SessionStateTracker();
  tracker.track({ id: 'hosted-1', cwd: '/projects/hosted', onExit: (listener) => (exitHosted = listener) });
  tracker.applyHookEvent('hosted-1', { hook_event_name: 'UserPromptSubmit', prompt: 'Explain', session_id: 'claude-hosted' });
  monitor = new UsageMonitor({ tracker, scanner, reader: new TranscriptReader({ claudeDir }) });
  app = Fastify();
  await app.register(fastifyWebsocket);
  registerSessionListRoute(app, tracker, scanner, undefined, monitor);
  registerSessionEventsRoute(app, tracker, scanner, undefined, monitor);
  await app.listen({ host: '127.0.0.1', port: 0 });
  monitor.start();
});

afterEach(async () => {
  client?.socket.terminate();
  client = undefined;
  monitor.stop();
  await app.close();
  await rm(claudeDir, { recursive: true, force: true });
});

describe('plan-session_usage context occupancy at the REST API', () => {
  // plan-session_usage/REQ-1, REQ-2, REQ-3, REQ-9: hosted and external entries carry used and window; none before the first response
  it('lists the context of hosted and external sessions, and none before their first response', async () => {
    expect((await sessions())['hosted-1']).not.toHaveProperty('usage');
    expect((await sessions())[external.id]).not.toHaveProperty('usage');

    await append(transcriptOf('/projects/hosted', 'claude-hosted'), lines(response(200, 15_000, 30_000)));
    await append(transcriptOf(external.folder, external.id), lines(response(100_000, 100_000, 100_000)));
    await waitFor(() => monitor.get('hosted-1') !== undefined && monitor.get(external.id) !== undefined, 'monitor read', 2_500);
    const listed = await sessions();
    expect(listed['hosted-1']?.usage).toEqual({ context: { used: 45_200, window: 200_000 } });
    expect(listed[external.id]?.usage).toEqual({ context: { used: 300_000, window: 1_000_000 } });
  });

  // plan-session_usage/REQ-12: a new main response reaches the page within 2 seconds as a session frame
  it('pushes a session frame with the new context within 2 seconds of a new response', async () => {
    const file = transcriptOf(external.folder, external.id);
    await append(file, lines(response(10_000, 0, 0)));
    await waitFor(() => monitor.get(external.id) !== undefined, 'first value', 2_500);
    const address = app.server.address();
    if (address === null || typeof address === 'string') throw new Error('no port');
    client = connectWs(`ws://127.0.0.1:${address.port}/api/sessions/events`);
    await new Promise<void>((resolve) => client!.socket.once('open', () => resolve()));

    await append(file, lines(response(5_000, 0, 0, true), response(20_000, 0, 0)));
    const frameWith = () => client!.frames.map((frame) => JSON.parse(frame)).find((frame) => frame.session?.usage?.context?.used === 20_000);
    await waitFor(() => frameWith() !== undefined, 'usage frame', 2_000);
    expect(frameWith()).toEqual({ type: 'session', session: { ...external, usage: { context: { used: 20_000, window: 200_000 } } } });
  });

  // plan-session_usage/REQ-7, REQ-10: an ended session keeps its context; a compaction removes it
  it('keeps the context of an ended session and removes it after a compaction', async () => {
    const file = transcriptOf('/projects/hosted', 'claude-hosted');
    await append(file, lines(response(80_000, 0, 0)));
    await waitFor(() => monitor.get('hosted-1') !== undefined, 'first value', 2_500);
    exitHosted();
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    expect(await sessions()).toMatchObject({ 'hosted-1': { state: 'ended', usage: { context: { used: 80_000, window: 200_000 } } } });

    await append(transcriptOf(external.folder, external.id), lines(response(80_000, 0, 0), { type: 'system', subtype: 'compact_boundary' }));
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    expect((await sessions())[external.id]).not.toHaveProperty('usage');
  });
});
