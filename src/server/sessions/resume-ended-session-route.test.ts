import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PastSession } from '../history/session-history.js';
import { tempDir } from '../test-support.js';
import { registerResumeEndedSessionRoute } from './resume-ended-session-route.js';
import type { ResumeInfo } from './session-registry.js';
import { SessionStateTracker } from './session-state-tracker.js';

let app: FastifyInstance;
let root: string;
let folder: string;
let tracker: SessionStateTracker;
let pastSessions: Record<string, PastSession>;
let hosted: { pid: number; exited: boolean }[];
let runningElsewhere: Set<string>;
let checkCalls: number[][];
let starts: { cwd: string; resume: ResumeInfo | undefined }[];
let log: string[];
const exits = new Map<string, () => void>();

const past = (id: string, pastFolder: string | null, firstUserMessage: string | null = 'Fix the cart'): PastSession => ({
  id,
  folder: pastFolder,
  firstUserMessage,
  lastModified: new Date('2026-11-01T00:00:00.000Z'),
});

function trackNew(id: string): void {
  tracker.track({ id, cwd: folder, onExit: (listener) => void exits.set(id, listener) });
}

/** An ended hosted session whose Claude Code session id is `claudeId`. */
function endedSession(id: string, claudeId: string): void {
  trackNew(id);
  tracker.applyHookEvent(id, { hook_event_name: 'UserPromptSubmit', prompt: 'Fix the cart', session_id: claudeId });
  exits.get(id)?.();
}

const resume = (id: string, body?: unknown) =>
  app.inject({ method: 'POST', url: `/api/sessions/${encodeURIComponent(id)}/resume`, ...(body === undefined ? {} : { payload: body as object }) });

beforeEach(async () => {
  root = await tempDir('ai-client-resume-ended-');
  folder = path.join(root, 'shop');
  await mkdir(folder);
  tracker = new SessionStateTracker();
  pastSessions = {};
  hosted = [];
  runningElsewhere = new Set();
  checkCalls = [];
  starts = [];
  log = [];
  exits.clear();
  tracker.onChange((summary, cause) => {
    if (cause.type === 'track') log.push(`track ${summary.id}`);
  });
  tracker.onRemove((id) => log.push(`remove ${id}`));
  app = Fastify();
  registerResumeEndedSessionRoute(app, {
    tracker,
    history: { get: async (id) => pastSessions[id] },
    registry: {
      start: (cwd, resumeInfo) => {
        starts.push({ cwd, resume: resumeInfo });
        const id = `new-${starts.length}`;
        tracker.track({ id, cwd, onExit: () => {}, resumedFrom: resumeInfo });
        return { id } as never;
      },
      list: () => hosted as never,
    },
    externalCheck: {
      runningSessionIds: async (pids) => {
        checkCalls.push([...pids]);
        return runningElsewhere;
      },
    },
  });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('POST /api/sessions/:id/resume', () => {
  // plan-session_list_improvements/REQ-8, REQ-11: one call resumes the Claude Code session and removes the ended entry
  it('201 with the new id, starts the conversation in its folder and removes the ended entry', async () => {
    endedSession('old', 'claude-1');
    pastSessions['claude-1'] = past('claude-1', folder, 'Fix the cart');

    const response = await resume('old', {});

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ id: 'new-1' });
    expect(starts).toEqual([{ cwd: folder, resume: { sessionId: 'claude-1', firstUserMessage: 'Fix the cart' } }]);
    expect(tracker.get('old')).toBeUndefined();
    expect(tracker.list().map((s) => s.id)).toEqual(['new-1']);
  });

  // plan-session_list_improvements/REQ-11: the new session is listed before the old entry is removed
  it('lists the new session first, then removes the old entry', async () => {
    endedSession('old', 'claude-1');
    pastSessions['claude-1'] = past('claude-1', folder);
    log = [];

    expect((await resume('old', {})).statusCode).toBe(201);

    expect(log).toEqual(['track new-1', 'remove old']);
  });

  // plan-session_list_improvements/REQ-8: a session that was itself resumed keeps the Claude Code session id it resumed
  it('resumes the Claude Code session id that a resumed and ended session was started with', async () => {
    tracker.track({ id: 'old', cwd: folder, onExit: (listener) => void exits.set('old', listener), resumedFrom: { sessionId: 'claude-9' } });
    exits.get('old')?.();
    pastSessions['claude-9'] = past('claude-9', folder);

    const response = await resume('old');

    expect(response.statusCode).toBe(201);
    expect(starts.map((s) => s.resume?.sessionId)).toEqual(['claude-9']);
  });

  // ResumeEndedSessionRoute contract: unknown id
  it('404 session_not_found for an unknown id, and no session starts', async () => {
    const response = await resume('missing', {});
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'session_not_found' });
    expect(starts).toEqual([]);
  });

  // ResumeEndedSessionRoute contract: a session that has not ended, checked before the Claude Code session id
  it('409 not_ended for a session that has not ended, also with no Claude Code session id, and no session starts', async () => {
    trackNew('live');
    trackNew('working');
    tracker.applyHookEvent('working', { hook_event_name: 'UserPromptSubmit', prompt: 'Go', session_id: 'claude-w' });
    pastSessions['claude-w'] = past('claude-w', folder);

    for (const id of ['live', 'working']) {
      const response = await resume(id, {});
      expect(response.statusCode, id).toBe(409);
      expect(response.json()).toEqual({ error: 'not_ended' });
    }
    expect(starts).toEqual([]);
    expect(tracker.list().map((s) => s.id)).toEqual(['live', 'working']);
  });

  // ResumeEndedSessionRoute contract: an ended session with no known Claude Code session id
  it('404 session_not_found for an ended session with no Claude Code session id, which stays listed', async () => {
    trackNew('old');
    exits.get('old')?.();

    const response = await resume('old', {});

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'session_not_found' });
    expect(starts).toEqual([]);
    expect(tracker.get('old')?.state).toBe('ended');
  });

  // plan-session_list_improvements/REQ-9: without force, a conversation running in a terminal is not resumed
  it.each([
    ['no body', undefined],
    ['an empty body', {}],
    ['force false', { force: false }],
    ['force as the string "true"', { force: 'true' }],
    ['force as 1', { force: 1 }],
  ])('409 running_elsewhere with %s when the conversation runs elsewhere; the check gets the pids of the hosted sessions still running', async (_, body) => {
    endedSession('old', 'claude-1');
    pastSessions['claude-1'] = past('claude-1', folder);
    hosted = [
      { pid: 101, exited: false },
      { pid: 102, exited: true },
      { pid: 103, exited: false },
    ];
    runningElsewhere = new Set(['claude-1']);

    const response = await resume('old', body);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'running_elsewhere' });
    expect(checkCalls).toEqual([[101, 103]]);
    expect(starts).toEqual([]);
    expect(tracker.get('old')?.state).toBe('ended');
  });

  // plan-session_list_improvements/REQ-8: without force, a conversation that runs nowhere else resumes
  it('201 without force when the check does not list the conversation', async () => {
    endedSession('old', 'claude-1');
    pastSessions['claude-1'] = past('claude-1', folder);
    runningElsewhere = new Set(['claude-other']);

    const response = await resume('old', {});

    expect(response.statusCode).toBe(201);
    expect(checkCalls).toHaveLength(1);
  });

  // plan-session_list_improvements/REQ-9: "Resume Anyway" sends force, which skips the check
  it('201 with force: true, without calling the running-elsewhere check', async () => {
    endedSession('old', 'claude-1');
    pastSessions['claude-1'] = past('claude-1', folder);
    runningElsewhere = new Set(['claude-1']);

    const response = await resume('old', { force: true });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ id: 'new-1' });
    expect(checkCalls).toEqual([]);
    expect(tracker.get('old')).toBeUndefined();
  });

  // plan-session_list_improvements/REQ-12: a failed resume keeps the ended entry and starts nothing
  it.each([
    ['session_not_found', 'the history has no such session', () => {}],
    ['session_not_found', 'the history session has no folder', () => void (pastSessions['claude-1'] = past('claude-1', null))],
    ['folder_not_found', 'the folder was deleted', () => void (pastSessions['claude-1'] = past('claude-1', path.join(root, 'deleted')))],
  ])('404 %s when %s, and the ended entry stays', async (error, _, setup) => {
    endedSession('old', 'claude-1');
    setup();

    const response = await resume('old', {});

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error });
    expect(starts).toEqual([]);
    expect(tracker.get('old')?.state).toBe('ended');
    expect(log.filter((entry) => entry.startsWith('remove'))).toEqual([]);
  });

  // ResumeEndedSessionRoute order of checks: running elsewhere comes before the resume step
  it('409 running_elsewhere before the resume step, even when the folder is gone', async () => {
    endedSession('old', 'claude-1');
    pastSessions['claude-1'] = past('claude-1', path.join(root, 'deleted'));
    runningElsewhere = new Set(['claude-1']);

    const response = await resume('old', {});

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'running_elsewhere' });
  });
});
