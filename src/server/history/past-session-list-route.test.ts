import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, afterEach, describe, expect, it } from 'vitest';
import { registerPastSessionListRoute } from './past-session-list-route.js';
import type { PastSession } from './session-history.js';

interface Fixture {
  past: PastSession[];
  running?: string[];
  hosted?: { pid: number; exited: boolean }[];
  live?: string[];
}

let app: FastifyInstance | undefined;
let seenHostedPids: number[] = [];

const past = (id: string, folder: string | null, firstUserMessage: string | null, iso: string): PastSession => ({
  id,
  folder,
  firstUserMessage,
  lastModified: new Date(iso),
});

async function get(fixture: Fixture) {
  app = Fastify();
  registerPastSessionListRoute(app, {
    history: { list: async () => fixture.past },
    externalCheck: {
      runningSessionIds: async (pids) => {
        seenHostedPids = [...pids];
        return new Set(fixture.running ?? []);
      },
    },
    registry: { list: () => (fixture.hosted ?? []) as never },
    tracker: { liveClaudeSessionIds: () => new Set(fixture.live ?? []) },
  });
  const response = await app.inject({ method: 'GET', url: '/api/past-sessions' });
  expect(response.statusCode).toBe(200);
  return response.json();
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('GET /api/past-sessions', () => {
  // plan-claude_sessions_client/REQ-25: grouped by folder, most recent first in each group and across groups
  it('groups the sessions by folder, the most recent first, groups ordered by their most recent session', async () => {
    const body = await get({
      past: [
        past('b2', '/work/b', 'B due', '2026-11-04T12:00:00.000Z'),
        past('a2', '/work/a', 'A due', '2026-11-03T12:00:00.000Z'),
        past('b1', '/work/b', 'B uno', '2026-11-02T12:00:00.000Z'),
        past('a1', '/work/a', 'A uno', '2026-11-01T12:00:00.000Z'),
      ],
    });
    expect(body).toEqual([
      {
        folder: '/work/b',
        available: false,
        sessions: [
          { id: 'b2', label: 'B due', lastActivity: '2026-11-04T12:00:00.000Z', runningElsewhere: false },
          { id: 'b1', label: 'B uno', lastActivity: '2026-11-02T12:00:00.000Z', runningElsewhere: false },
        ],
      },
      {
        folder: '/work/a',
        available: false,
        sessions: [
          { id: 'a2', label: 'A due', lastActivity: '2026-11-03T12:00:00.000Z', runningElsewhere: false },
          { id: 'a1', label: 'A uno', lastActivity: '2026-11-01T12:00:00.000Z', runningElsewhere: false },
        ],
      },
    ]);
  });

  // plan-claude_sessions_client/REQ-13: same label rule as the hosted sessions
  it('cuts the label: one space per whitespace run, trimmed, first 80 characters', async () => {
    const long = `  Riga\n\tuno   ${'x'.repeat(100)}`;
    const body = await get({ past: [past('s', '/work/a', long, '2026-11-01T00:00:00.000Z')] });
    expect(body[0].sessions[0].label).toBe(`Riga uno ${'x'.repeat(71)}`);
  });

  it('gives lastActivity as an ISO-8601 UTC string', async () => {
    const body = await get({ past: [past('s', '/work/a', 'Ciao', '2026-11-01T10:00:00+02:00')] });
    expect(body[0].sessions[0].lastActivity).toBe('2026-11-01T08:00:00.000Z');
  });

  // plan-claude_sessions_client/REQ-27
  it('flags runningElsewhere for the ids ExternalSessionCheck gives', async () => {
    const body = await get({
      past: [past('ext', '/work/a', 'Esterna', '2026-11-02T00:00:00.000Z'), past('quiet', '/work/a', 'Ferma', '2026-11-01T00:00:00.000Z')],
      running: ['ext'],
    });
    expect(body[0].sessions.map((s: { id: string; runningElsewhere: boolean }) => [s.id, s.runningElsewhere])).toEqual([
      ['ext', true],
      ['quiet', false],
    ]);
  });

  it('passes ExternalSessionCheck the pids of the hosted sessions whose process has not ended', async () => {
    await get({
      past: [],
      hosted: [
        { pid: 11, exited: false },
        { pid: 12, exited: true },
        { pid: 13, exited: false },
      ],
    });
    expect(seenHostedPids.sort()).toEqual([11, 13]);
  });

  it('leaves out sessions without a folder or without a first user message', async () => {
    const body = await get({
      past: [
        past('no-folder', null, 'Messaggio', '2026-11-03T00:00:00.000Z'),
        past('no-message', '/work/a', null, '2026-11-02T00:00:00.000Z'),
        past('ok', '/work/a', 'Messaggio', '2026-11-01T00:00:00.000Z'),
      ],
    });
    expect(body).toEqual([{ folder: '/work/a', available: false, sessions: [expect.objectContaining({ id: 'ok' })] }]);
  });

  it('leaves out sessions the client hosts that have not ended, and drops a group left empty', async () => {
    const body = await get({
      past: [
        past('hosted-live', '/work/a', 'Ospitata', '2026-11-03T00:00:00.000Z'),
        past('only-one', '/work/b', 'Sola', '2026-11-02T00:00:00.000Z'),
        past('ended-or-free', '/work/a', 'Libera', '2026-11-01T00:00:00.000Z'),
      ],
      live: ['hosted-live', 'only-one'],
    });
    expect(body).toEqual([{ folder: '/work/a', available: false, sessions: [expect.objectContaining({ id: 'ended-or-free' })] }]);
  });

  it('is an empty array when there is no past session', async () => {
    expect(await get({ past: [] })).toEqual([]);
  });

  describe('available (plan-recent_projects/REQ-10)', () => {
    let root: string;

    beforeAll(async () => {
      root = await mkdtemp(path.join(os.tmpdir(), 'past-session-list-route-'));
    });

    afterAll(async () => {
      await chmod(path.join(root, 'locked'), 0o755).catch(() => {});
      await rm(root, { recursive: true, force: true });
    });

    const availabilityOf = async (folder: string) => {
      const body = await get({ past: [past('s', folder, 'Message', '2026-11-01T00:00:00.000Z')] });
      return body[0].available;
    };

    it('is true when the folder exists on disk as a folder', async () => {
      const folder = path.join(root, 'present');
      await mkdir(folder);
      expect(await availabilityOf(folder)).toBe(true);
    });

    it('is false when the folder does not exist, and the group stays in the answer', async () => {
      const folder = path.join(root, 'missing');
      const body = await get({ past: [past('s', folder, 'Message', '2026-11-01T00:00:00.000Z')] });
      expect(body).toEqual([{ folder, available: false, sessions: [expect.objectContaining({ id: 's' })] }]);
    });

    it('is false when the path is a file', async () => {
      const file = path.join(root, 'a-file');
      await writeFile(file, 'x');
      expect(await availabilityOf(file)).toBe(false);
    });

    it.skipIf(process.getuid?.() === 0)('is false when the path cannot be read', async () => {
      const locked = path.join(root, 'locked');
      await mkdir(path.join(locked, 'inner'), { recursive: true });
      await chmod(locked, 0o000);
      expect(await availabilityOf(path.join(locked, 'inner'))).toBe(false);
    });

    it('is checked again at each request', async () => {
      const folder = path.join(root, 'appears-later');
      const sessions = [past('s', folder, 'Message', '2026-11-01T00:00:00.000Z')];
      app = Fastify();
      registerPastSessionListRoute(app, {
        history: { list: async () => sessions },
        externalCheck: { runningSessionIds: async () => new Set<string>() },
        registry: { list: () => [] as never },
        tracker: { liveClaudeSessionIds: () => new Set<string>() },
      });
      const availableNow = async () => (await app!.inject({ method: 'GET', url: '/api/past-sessions' })).json()[0].available;
      expect(await availableNow()).toBe(false);
      await mkdir(folder);
      expect(await availableNow()).toBe(true);
      await rm(folder, { recursive: true });
      expect(await availableNow()).toBe(false);
    });
  });
});
