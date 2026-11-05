import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RecordingViewer, tempDir, waitFor, writeSigtermScript } from '../test-support.js';
import { type Session, SessionRegistry } from './session-registry.js';
import { registerStopSessionRoute } from './stop-session-route.js';

let app: FastifyInstance;
let workDir: string;
let registry: SessionRegistry;
const started: Session[] = [];

beforeAll(async () => {
  workDir = await tempDir();
  const ignoresSigterm = await writeSigtermScript(workDir, 'ignores-sigterm.mjs', 'ignore');
  registry = new SessionRegistry({ command: ignoresSigterm, stopTimeoutMs: 1500 });
  app = Fastify();
  registerStopSessionRoute(app, registry);
  await app.ready();
});

afterAll(async () => {
  for (const session of started) session.stop();
  await waitFor(() => started.every((session) => session.exited), 'sessions exit', 8000);
  await app.close();
});

async function startReady(): Promise<{ session: Session; viewer: RecordingViewer }> {
  const session = registry.start(workDir);
  started.push(session);
  const viewer = new RecordingViewer();
  session.attach(viewer);
  await waitFor(() => viewer.text.includes('READY'), 'CLI banner');
  return { session, viewer };
}

const stop = (id: string) => app.inject({ method: 'POST', url: `/api/sessions/${id}/stop` });

describe('POST /api/sessions/:id/stop', () => {
  // plan-claude_sessions_client/REQ-23: 202 with an empty body, without waiting for the process to end
  it('202 with an empty body before the process ends, then the process ends', async () => {
    const { session, viewer } = await startReady();
    const response = await stop(session.id);
    expect(response.statusCode).toBe(202);
    expect(response.body).toBe('');
    expect(session.exited, 'the answer does not wait for the exit').toBe(false);
    await waitFor(() => viewer.text.includes('GOT-SIGTERM'), 'SIGTERM received');
    await waitFor(() => session.exited, 'exit after SIGKILL', 4000);
  });

  // plan-claude_sessions_client/REQ-23: a session whose process already ended also gets 202
  it('202 with an empty body for a session that already ended', async () => {
    const { session } = await startReady();
    session.stop();
    await waitFor(() => session.exited, 'exit', 4000);
    const response = await stop(session.id);
    expect(response.statusCode).toBe(202);
    expect(response.body).toBe('');
  });

  // plan-claude_sessions_client/REQ-23: unknown session
  it('404 session_not_found for an unknown id', async () => {
    const response = await stop('no-such-session');
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'session_not_found' });
  });
});
