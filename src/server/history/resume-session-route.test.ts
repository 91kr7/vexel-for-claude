import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ResumeInfo } from '../sessions/session-registry.js';
import { tempDir } from '../test-support.js';
import { registerResumeSessionRoute } from './resume-session-route.js';
import type { PastSession } from './session-history.js';

let app: FastifyInstance;
let root: string;
let sessions: Record<string, PastSession>;
let starts: { cwd: string; resume: ResumeInfo | undefined }[];

const past = (id: string, folder: string | null, firstUserMessage: string | null = 'Ciao'): PastSession => ({
  id,
  folder,
  firstUserMessage,
  lastModified: new Date('2026-11-01T00:00:00.000Z'),
});

const resume = (id: string) => app.inject({ method: 'POST', url: `/api/past-sessions/${encodeURIComponent(id)}/resume` });

beforeEach(async () => {
  root = await tempDir('ai-client-resume-');
  sessions = {};
  starts = [];
  app = Fastify();
  registerResumeSessionRoute(app, {
    history: { get: async (id) => sessions[id] },
    registry: {
      start: (cwd, resumeInfo) => {
        starts.push({ cwd, resume: resumeInfo });
        return { id: `hosted-${starts.length}` } as never;
      },
    },
  });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('POST /api/past-sessions/:id/resume', () => {
  // plan-claude_sessions_client/REQ-25, REQ-26
  it('201 with the new hosted session id, started in the session folder with its id and first user message', async () => {
    const folder = path.join(root, 'project');
    await mkdir(folder);
    sessions['abc-1'] = past('abc-1', folder, 'Correggi il bug');

    const response = await resume('abc-1');

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ id: 'hosted-1' });
    expect(starts).toEqual([{ cwd: folder, resume: { sessionId: 'abc-1', firstUserMessage: 'Correggi il bug' } }]);
  });

  it('404 session_not_found for an id the history does not have, and no session starts', async () => {
    const response = await resume('missing');
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'session_not_found' });
    expect(starts).toEqual([]);
  });

  it('404 session_not_found for a session without a folder, and no session starts', async () => {
    sessions['no-folder'] = past('no-folder', null);
    const response = await resume('no-folder');
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'session_not_found' });
    expect(starts).toEqual([]);
  });

  it('404 folder_not_found when the folder does not exist, and no session starts', async () => {
    sessions['gone'] = past('gone', path.join(root, 'deleted'));
    const response = await resume('gone');
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'folder_not_found' });
    expect(starts).toEqual([]);
  });

  it('404 folder_not_found when the folder is a file, and no session starts', async () => {
    const file = path.join(root, 'a-file');
    await writeFile(file, 'x');
    sessions['file'] = past('file', file);
    const response = await resume('file');
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'folder_not_found' });
    expect(starts).toEqual([]);
  });
});
