import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { ExternalSessionSummary } from '../external/external-session-scanner.js';
import type { RunningTool } from './running-tool.js';
import { registerSessionListRoute } from './session-list-route.js';
import { SessionStateTracker } from './session-state-tracker.js';

const external: ExternalSessionSummary = {
  id: 'ext-1',
  folder: '/projects/outside',
  label: 'outside',
  state: 'working',
  lastActivity: '2026-11-06T09:00:00.000Z',
  external: true,
};

async function listWith(tools: Record<string, RunningTool> | undefined): Promise<Record<string, unknown>[]> {
  const tracker = new SessionStateTracker({ now: () => new Date('2026-11-06T09:30:00.000Z') });
  for (const id of ['h-1', 'h-2']) {
    tracker.track({ id, cwd: `/projects/${id}`, onExit: () => {} });
    tracker.applyHookEvent(id, { hook_event_name: 'UserPromptSubmit', prompt: 'Run the tests' });
  }
  const app = Fastify();
  registerSessionListRoute(app, tracker, { list: () => [external] }, tools && { get: (id: string) => tools[id] });
  const response = await app.inject({ method: 'GET', url: '/api/sessions' });
  await app.close();
  expect(response.statusCode).toBe(200);
  return response.json();
}

describe('GET /api/sessions, running tool', () => {
  // plan-session_list_improvements/REQ-14: hosted and external entries carry the monitor's tool
  it('adds runningTool to each hosted and external entry that has one', async () => {
    const bash: RunningTool = { name: 'Bash', argument: 'npm test', others: 2 };
    const read: RunningTool = { name: 'Read', argument: '/a.ts', others: 0 };
    const sessions = await listWith({ 'h-1': bash, 'ext-1': read });
    expect(sessions.map((s) => s.id)).toEqual(['h-1', 'h-2', 'ext-1']);
    expect(sessions[0]).toMatchObject({ id: 'h-1', state: 'working', runningTool: bash });
    expect(sessions[2]).toEqual({ ...external, runningTool: read });
  });

  // plan-session_list_improvements/REQ-22: an entry with no running tool has no runningTool
  it('leaves runningTool out when the monitor has no tool for the entry', async () => {
    const sessions = await listWith({ 'h-1': { name: 'TodoWrite', others: 0 } });
    expect(sessions[0]?.runningTool).toEqual({ name: 'TodoWrite', others: 0 });
    expect(sessions[1]).not.toHaveProperty('runningTool');
    expect(sessions[2]).toEqual(external);
  });

  // SessionListRoute contract: without the monitor, no entry has runningTool
  it('has no runningTool without a monitor', async () => {
    const sessions = await listWith(undefined);
    expect(sessions).toHaveLength(3);
    for (const session of sessions) expect(session).not.toHaveProperty('runningTool');
  });
});
