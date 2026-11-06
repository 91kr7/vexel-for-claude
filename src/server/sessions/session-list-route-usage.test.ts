import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { ExternalSessionSummary } from '../external/external-session-scanner.js';
import type { RunningTool } from './running-tool.js';
import { registerSessionListRoute } from './session-list-route.js';
import { SessionStateTracker } from './session-state-tracker.js';
import type { SessionUsage } from './usage-monitor.js';

const external: ExternalSessionSummary = {
  id: 'ext-1',
  folder: '/projects/outside',
  label: 'outside',
  state: 'idle',
  lastActivity: '2026-11-06T09:00:00.000Z',
  external: true,
};

async function listWith(usages: Record<string, SessionUsage> | undefined, tools: Record<string, RunningTool> = {}): Promise<Record<string, unknown>[]> {
  const tracker = new SessionStateTracker({ now: () => new Date('2026-11-06T09:30:00.000Z') });
  tracker.track({ id: 'h-1', cwd: '/projects/h-1', onExit: () => {} });
  tracker.applyHookEvent('h-1', { hook_event_name: 'UserPromptSubmit', prompt: 'Run the tests' });
  tracker.track({ id: 'h-ended', cwd: '/projects/h-ended', onExit: (listener) => listener() });
  tracker.track({ id: 'h-none', cwd: '/projects/h-none', onExit: () => {} });
  const app = Fastify();
  registerSessionListRoute(app, tracker, { list: () => [external] }, { get: (id: string) => tools[id] }, usages && { get: (id: string) => usages[id] });
  const response = await app.inject({ method: 'GET', url: '/api/sessions' });
  await app.close();
  expect(response.statusCode).toBe(200);
  return response.json();
}

describe('GET /api/sessions, usage', () => {
  const half: SessionUsage = { context: { used: 100_000, window: 200_000 } };
  const ended: SessionUsage = { context: { used: 80_000, window: 200_000 } };
  const outside: SessionUsage = { context: { used: 300_000, window: 1_000_000 } };

  // plan-session_usage/REQ-1, REQ-2, REQ-10: hosted (ended included) and external entries carry the monitor's usage
  it('adds usage to each hosted and external entry that has one, in any state', async () => {
    const sessions = await listWith({ 'h-1': half, 'h-ended': ended, 'ext-1': outside });
    expect(sessions.map((s) => s.id)).toEqual(['h-1', 'h-ended', 'h-none', 'ext-1']);
    expect(sessions[0]).toMatchObject({ id: 'h-1', state: 'working', usage: half });
    expect(sessions[1]).toMatchObject({ id: 'h-ended', state: 'ended', usage: ended });
    expect(sessions[3]).toEqual({ ...external, usage: outside });
  });

  // plan-session_usage/REQ-9: an entry with no usage has no usage field
  it('leaves out usage when the monitor gives none', async () => {
    const [, , none] = await listWith({ 'h-1': half });
    expect(none).not.toHaveProperty('usage');
  });

  // SessionListRoute spec: without the monitor no entry has usage
  it('gives no usage without the monitor', async () => {
    const sessions = await listWith(undefined);
    for (const session of sessions) expect(session).not.toHaveProperty('usage');
  });

  // SessionListRoute spec: runningTool and usage together
  it('carries runningTool and usage on the same entry', async () => {
    const bash: RunningTool = { name: 'Bash', argument: 'npm test', others: 0 };
    const [first] = await listWith({ 'h-1': half }, { 'h-1': bash });
    expect(first).toMatchObject({ runningTool: bash, usage: half });
  });
});
