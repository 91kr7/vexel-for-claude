import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExternalSessionCheck, type RunningSessionFile } from '../history/external-session-check.js';
import { type PastSession, SessionHistory } from '../history/session-history.js';
import { SessionFavoriteStore } from '../sessions/session-favorite-store.js';
import { SessionNameStore } from '../sessions/session-name-store.js';
import { delay, snapshotTree, tempDir, userEntry, writeHistorySession } from '../test-support.js';
import { type ExternalSessionChange, ExternalSessionScanner } from './external-session-scanner.js';

const SCAN_TIME = new Date('2026-11-05T09:00:00.000Z');
const UPDATED_AT = Date.parse('2026-11-05T08:30:00.000Z');

const sessionFile = (pid: number, sessionId: string, extra: Partial<RunningSessionFile> = {}): RunningSessionFile => ({
  pid,
  sessionId,
  cwd: `/home/dev/${sessionId}`,
  kind: 'interactive',
  status: 'idle',
  updatedAt: UPDATED_AT,
  ...extra,
});

const pastSession = (id: string, firstUserMessage: string | null): PastSession => ({
  id,
  folder: `/home/dev/${id}`,
  firstUserMessage,
  lastModified: SCAN_TIME,
});

interface Fixture {
  files: RunningSessionFile[];
  messages: Map<string, string | null>;
  hosted: number[];
  hostedIds: Set<string>;
  check: { runningSessions: ReturnType<typeof vi.fn> };
  history: { get: ReturnType<typeof vi.fn> };
  scanner: ExternalSessionScanner;
  changes: ExternalSessionChange[];
  clock: { now: Date };
}

function fixture(options: { intervalMs?: number; names?: SessionNameStore; favorites?: SessionFavoriteStore } = {}): Fixture {
  const f = {
    files: [] as RunningSessionFile[],
    messages: new Map<string, string | null>(),
    hosted: [] as number[],
    hostedIds: new Set<string>(),
    changes: [] as ExternalSessionChange[],
    clock: { now: SCAN_TIME },
  } as Fixture;
  f.check = { runningSessions: vi.fn(async () => f.files.map((file) => ({ ...file }))) };
  f.history = {
    get: vi.fn(async (id: string) => (f.messages.has(id) ? pastSession(id, f.messages.get(id) ?? null) : undefined)),
  };
  f.scanner = new ExternalSessionScanner({
    check: f.check as never,
    history: f.history as never,
    hostedPids: () => f.hosted,
    hostedSessionIds: () => f.hostedIds,
    now: () => f.clock.now,
    ...options,
  });
  f.scanner.onChange((change) => f.changes.push(change));
  return f;
}

const scanners: ExternalSessionScanner[] = [];

afterEach(() => {
  for (const scanner of scanners.splice(0)) scanner.stop();
  vi.useRealTimers();
});

describe('ExternalSessionScanner entries', () => {
  // plan-claude_sessions_client/REQ-29
  it('asks the check for the live files that are not hosted, with the hosted pids', async () => {
    const f = fixture();
    f.hosted = [11, 12];
    await f.scanner.scan();
    expect(f.check.runningSessions).toHaveBeenCalledWith([11, 12]);
  });

  // plan-claude_sessions_client/REQ-29, REQ-30
  it('gives one entry per interactive session file with id, folder, label, state, last activity and the external marker', async () => {
    const f = fixture();
    f.files = [sessionFile(101, 'abc')];
    f.messages.set('abc', 'Correggi il login');
    await f.scanner.scan();
    expect(f.scanner.list()).toEqual([
      { id: 'abc', folder: '/home/dev/abc', label: 'Correggi il login', state: 'idle', lastActivity: '2026-11-05T08:30:00.000Z', external: true },
    ]);
    expect(f.scanner.get('abc')).toEqual(f.scanner.list()[0]);
    expect(f.scanner.get('unknown')).toBeUndefined();
  });

  // plan-claude_sessions_client/REQ-29
  it('keeps only kind "interactive" with a non-empty string cwd', async () => {
    const f = fixture();
    f.files = [
      sessionFile(1, 'interactive'),
      sessionFile(2, 'non-interactive', { kind: 'print' }),
      sessionFile(3, 'no-kind', { kind: undefined }),
      sessionFile(4, 'no-cwd', { cwd: undefined }),
      sessionFile(5, 'empty-cwd', { cwd: '' }),
    ];
    await f.scanner.scan();
    expect(f.scanner.list().map((s) => s.id)).toEqual(['interactive']);
  });

  // plan-claude_sessions_client/REQ-31, plan-claude_sessions_client-ui_redesign-material3_mock/REQ-17: busy is working, waiting is needs_input, anything else idle
  it('state is working for status "busy", needs_input for "waiting" and idle for any other status or none', async () => {
    const f = fixture();
    f.files = [
      sessionFile(1, 'busy', { status: 'busy' }),
      sessionFile(2, 'idle', { status: 'idle' }),
      sessionFile(3, 'waiting', { status: 'waiting' }),
      sessionFile(4, 'shell', { status: 'shell' }),
      sessionFile(5, 'none', { status: undefined }),
    ];
    await f.scanner.scan();
    expect(Object.fromEntries(f.scanner.list().map((s) => [s.id, s.state]))).toEqual({
      busy: 'working',
      idle: 'idle',
      waiting: 'needs_input',
      shell: 'idle',
      none: 'idle',
    });
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-17: a session that starts waiting is notified as needs_input
  it('notifies the change to needs_input when a busy session starts waiting', async () => {
    const f = fixture();
    f.files = [sessionFile(1, 'asks', { status: 'busy' })];
    await f.scanner.scan();
    f.changes.length = 0;
    f.files = [sessionFile(1, 'asks', { status: 'waiting' })];
    await f.scanner.scan();
    expect(f.changes).toEqual([{ type: 'session', session: expect.objectContaining({ id: 'asks', state: 'needs_input', external: true }) }]);
  });

  // plan-claude_sessions_client/REQ-30
  it('without a numeric updatedAt, the last activity is the time of the scan that first found the entry', async () => {
    const f = fixture();
    f.files = [sessionFile(1, 'no-time', { updatedAt: undefined })];
    await f.scanner.scan();
    f.clock.now = new Date('2026-11-05T09:05:00.000Z');
    await f.scanner.scan();
    expect(f.scanner.get('no-time')?.lastActivity).toBe(SCAN_TIME.toISOString());
  });

  // plan-claude_sessions_client/REQ-30
  it('the label is the first user message with whitespace collapsed, cut to 80 characters', async () => {
    const f = fixture();
    const words = 'Aggiorna   la pagina\n del carrello e '.repeat(5);
    f.files = [sessionFile(1, 'long')];
    f.messages.set('long', words);
    await f.scanner.scan();
    expect(f.scanner.get('long')?.label).toBe(words.replace(/\s+/g, ' ').trim().slice(0, 80));
  });

  // plan-claude_sessions_client/REQ-30
  it('the label is the last name of the folder until the first user message, then the message', async () => {
    const f = fixture();
    f.files = [sessionFile(1, 'fresh', { cwd: '/home/dev/shop-app' }), sessionFile(2, 'no-history', { cwd: '/srv/blog' })];
    f.messages.set('fresh', null);
    await f.scanner.scan();
    expect(f.scanner.get('fresh')?.label).toBe('shop-app');
    expect(f.scanner.get('no-history')?.label).toBe('blog');
    f.messages.set('fresh', 'Primo messaggio');
    await f.scanner.scan();
    expect(f.scanner.get('fresh')?.label).toBe('Primo messaggio');
  });

  it('does not read the history again for an entry whose label came from a user message', async () => {
    const f = fixture();
    f.files = [sessionFile(1, 'once')];
    f.messages.set('once', 'Messaggio');
    await f.scanner.scan();
    await f.scanner.scan();
    await f.scanner.scan();
    expect(f.history.get.mock.calls.filter(([id]) => id === 'once')).toHaveLength(1);
  });

  it('two files with the same sessionId give one entry, from the file with the higher updatedAt', async () => {
    const f = fixture();
    f.files = [
      sessionFile(1, 'dup', { cwd: '/old', status: 'idle', updatedAt: UPDATED_AT }),
      sessionFile(2, 'dup', { cwd: '/new', status: 'busy', updatedAt: UPDATED_AT + 5000 }),
      sessionFile(3, 'dup', { cwd: '/older', status: 'idle', updatedAt: UPDATED_AT - 5000 }),
    ];
    await f.scanner.scan();
    expect(f.scanner.list()).toEqual([expect.objectContaining({ id: 'dup', folder: '/new', state: 'working' })]);
  });

  it('list gives a copy', async () => {
    const f = fixture();
    f.files = [sessionFile(1, 'a')];
    await f.scanner.scan();
    const list = f.scanner.list();
    list.pop();
    expect(f.scanner.list()).toHaveLength(1);
  });
});

describe('ExternalSessionScanner changes', () => {
  // plan-claude_sessions_client/REQ-32, plan-wsl_support/REQ-7: a vanished session turns ended instead of leaving
  it('notifies an addition, a change and the end, and nothing when the data is the same', async () => {
    const f = fixture();
    f.files = [sessionFile(1, 'a')];
    await f.scanner.scan();
    expect(f.changes).toEqual([{ type: 'session', session: f.scanner.get('a') }]);

    await f.scanner.scan();
    expect(f.changes).toHaveLength(1);

    f.files = [sessionFile(1, 'a', { status: 'busy', updatedAt: UPDATED_AT + 1000 })];
    await f.scanner.scan();
    expect(f.changes.at(-1)).toEqual({
      type: 'session',
      session: expect.objectContaining({ id: 'a', state: 'working', lastActivity: new Date(UPDATED_AT + 1000).toISOString() }),
    });

    f.files = [];
    await f.scanner.scan();
    expect(f.changes.at(-1)).toEqual({
      type: 'session',
      session: expect.objectContaining({ id: 'a', state: 'ended', external: true }),
    });
    expect(f.changes).toHaveLength(3);
    expect(f.scanner.list()).toEqual([expect.objectContaining({ id: 'a', state: 'ended' })]);
  });

  // plan-claude_sessions_client/REQ-32, plan-wsl_support/REQ-12: resumed in the client, so it leaves
  it('a session that becomes hosted leaves the list', async () => {
    const f = fixture();
    f.check.runningSessions.mockImplementation(async (hosted: Iterable<number>) => {
      const pids = new Set(hosted);
      return f.files.filter((file) => !pids.has(file.pid));
    });
    f.files = [sessionFile(7, 'taken')];
    await f.scanner.scan();
    f.hosted = [7];
    f.hostedIds = new Set(['taken']);
    await f.scanner.scan();
    expect(f.changes.map((c) => c.type)).toEqual(['session', 'session-removed']);
    expect(f.scanner.list()).toEqual([]);
  });

  it('a label that changes from the folder name to the first message is notified', async () => {
    const f = fixture();
    f.files = [sessionFile(1, 'a', { cwd: '/home/dev/a' })];
    await f.scanner.scan();
    f.messages.set('a', 'Ciao');
    await f.scanner.scan();
    expect(f.changes.map((c) => (c.type === 'session' ? c.session.label : c.type))).toEqual(['a', 'Ciao']);
  });

  it('stops calling a listener after it unsubscribes', async () => {
    const f = fixture();
    const listener = vi.fn();
    const unsubscribe = f.scanner.onChange(listener);
    f.files = [sessionFile(1, 'a')];
    await f.scanner.scan();
    unsubscribe();
    f.files = [];
    await f.scanner.scan();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('a failed scan changes nothing, and the next scan runs as usual', async () => {
    const f = fixture();
    f.files = [sessionFile(1, 'a')];
    await f.scanner.scan();
    f.check.runningSessions.mockRejectedValueOnce(new Error('EACCES'));
    await expect(f.scanner.scan()).resolves.toBeUndefined();
    expect(f.scanner.list().map((s) => s.id)).toEqual(['a']);
    expect(f.changes).toHaveLength(1);
    f.files = [];
    await f.scanner.scan();
    expect(f.changes.at(-1)).toEqual({ type: 'session', session: expect.objectContaining({ id: 'a', state: 'ended' }) });
  });
});

describe('ExternalSessionScanner ended entries', () => {
  async function endedFixture(options: Parameters<typeof fixture>[0] = {}) {
    const f = fixture(options);
    f.files = [sessionFile(1, 'a'), sessionFile(2, 'b')];
    await f.scanner.scan();
    f.files = [sessionFile(2, 'b')];
    await f.scanner.scan();
    return f;
  }

  // plan-wsl_support/REQ-8: the ended entry stays, and later scans notify nothing
  it('keeps an ended entry over the next scans, with no new notification', async () => {
    const f = await endedFixture();
    const ended = f.scanner.get('a');
    expect(ended?.state).toBe('ended');
    const count = f.changes.length;
    await f.scanner.scan();
    await f.scanner.scan();
    expect(f.changes).toHaveLength(count);
    expect(f.scanner.get('a')).toEqual(ended);
    expect(f.scanner.list().map((s) => s.id).sort()).toEqual(['a', 'b']);
  });

  // plan-wsl_support/REQ-10: Resume is offered only when the conversation is saved
  it('marks an ended entry resumable when its conversation is saved with a folder', async () => {
    const f = fixture();
    f.messages.set('saved', 'Fix the build');
    f.files = [sessionFile(1, 'saved'), sessionFile(2, 'unsaved')];
    await f.scanner.scan();
    expect(f.scanner.get('saved')).not.toHaveProperty('resumable');
    f.history.get.mockImplementation(async (id: string) =>
      id === 'saved' ? pastSession(id, 'Fix the build') : id === 'nofolder' ? { ...pastSession(id, null), folder: null } : undefined,
    );
    f.files = [sessionFile(3, 'nofolder')];
    await f.scanner.scan();
    f.files = [];
    await f.scanner.scan();
    expect(f.scanner.get('saved')).toMatchObject({ state: 'ended', resumable: true });
    expect(f.scanner.get('unsaved')?.state).toBe('ended');
    expect(f.scanner.get('unsaved')).not.toHaveProperty('resumable');
    expect(f.scanner.get('nofolder')?.state).toBe('ended');
    expect(f.scanner.get('nofolder')).not.toHaveProperty('resumable');
  });

  // plan-wsl_support/REQ-15: the label, the client name and the favorite mark survive the end
  it('keeps the label, the name and the favorite mark of the ended entry', async () => {
    const names = new SessionNameStore(undefined, [['named', 'Nightly job']]);
    const favorites = new SessionFavoriteStore(undefined, ['named', 'plain']);
    const f = fixture({ names, favorites });
    f.messages.set('plain', 'Write the release notes');
    f.files = [sessionFile(1, 'named'), sessionFile(2, 'plain')];
    await f.scanner.scan();
    f.files = [];
    await f.scanner.scan();
    expect(f.scanner.get('named')).toMatchObject({ state: 'ended', label: 'Nightly job', favorite: true });
    expect(f.scanner.get('plain')).toMatchObject({ state: 'ended', label: 'Write the release notes', favorite: true });
  });

  // plan-wsl_support/REQ-15: a name or favorite change of an ended entry is still notified
  it('notifies a name or favorite change of an ended entry, and keeps it ended', async () => {
    const names = new SessionNameStore();
    const favorites = new SessionFavoriteStore();
    const f = await endedFixture({ names, favorites });
    f.changes.length = 0;
    await names.set('a', 'Renamed');
    await favorites.set('a', true);
    expect(f.changes).toEqual([
      { type: 'session', session: expect.objectContaining({ id: 'a', state: 'ended', label: 'Renamed' }) },
      { type: 'session', session: expect.objectContaining({ id: 'a', state: 'ended', favorite: true }) },
    ]);
  });

  // plan-wsl_support/REQ-12: an ended entry whose conversation now runs in the client leaves the list
  it('removes an ended entry when its id becomes a live hosted session', async () => {
    const f = await endedFixture();
    f.hostedIds = new Set(['a']);
    await f.scanner.scan();
    expect(f.changes.at(-1)).toEqual({ type: 'session-removed', id: 'a' });
    expect(f.scanner.get('a')).toBeUndefined();
    expect(f.scanner.list().map((s) => s.id)).toEqual(['b']);
  });

  // plan-wsl_support/REQ-7: without hostedSessionIds an ended entry never leaves by itself
  it('keeps an ended entry when no hosted session ids are given', async () => {
    const f = fixture();
    const scanner = new ExternalSessionScanner({
      check: f.check as never,
      history: f.history as never,
      hostedPids: () => [],
      now: () => f.clock.now,
    });
    f.files = [sessionFile(1, 'a')];
    await scanner.scan();
    f.files = [];
    await scanner.scan();
    await scanner.scan();
    expect(scanner.get('a')?.state).toBe('ended');
  });

  // An ended entry found again by a scan runs again: state from its file, no resumable
  it('lists an ended entry as running again when its file comes back', async () => {
    const f = fixture();
    f.messages.set('a', 'Hello');
    f.files = [sessionFile(1, 'a')];
    await f.scanner.scan();
    f.files = [];
    await f.scanner.scan();
    expect(f.scanner.get('a')).toMatchObject({ state: 'ended', resumable: true });
    f.files = [sessionFile(4, 'a', { status: 'busy' })];
    await f.scanner.scan();
    expect(f.changes.at(-1)).toEqual({ type: 'session', session: expect.objectContaining({ id: 'a', state: 'working' }) });
    expect(f.scanner.get('a')?.state).toBe('working');
    expect(f.scanner.get('a')).not.toHaveProperty('resumable');
  });
});

describe('ExternalSessionScanner dismiss', () => {
  // plan-wsl_support/REQ-9: dismiss removes an ended entry and notifies the removal
  it('removes an ended entry and notifies session-removed', async () => {
    const f = fixture();
    f.files = [sessionFile(1, 'a'), sessionFile(2, 'b')];
    await f.scanner.scan();
    f.files = [sessionFile(2, 'b')];
    await f.scanner.scan();
    expect(f.scanner.dismiss('a')).toBe(true);
    expect(f.changes.at(-1)).toEqual({ type: 'session-removed', id: 'a' });
    expect(f.scanner.get('a')).toBeUndefined();
    expect(f.scanner.list().map((s) => s.id)).toEqual(['b']);
  });

  // dismiss(id) → false with no change when the id is unknown or its entry has not ended
  it('refuses an unknown id and a running entry, with no change and no notification', async () => {
    const f = fixture();
    f.files = [sessionFile(1, 'a')];
    await f.scanner.scan();
    const before = f.scanner.list();
    const count = f.changes.length;
    expect(f.scanner.dismiss('unknown')).toBe(false);
    expect(f.scanner.dismiss('a')).toBe(false);
    expect(f.scanner.list()).toEqual(before);
    expect(f.changes).toHaveLength(count);
  });

  // plan-wsl_support/REQ-9: a dismissed id does not come back as ended
  it('does not bring a dismissed entry back as ended on the next scans', async () => {
    const f = fixture();
    f.files = [sessionFile(1, 'a')];
    await f.scanner.scan();
    f.files = [];
    await f.scanner.scan();
    f.scanner.dismiss('a');
    const count = f.changes.length;
    await f.scanner.scan();
    await f.scanner.scan();
    expect(f.changes).toHaveLength(count);
    expect(f.scanner.list()).toEqual([]);
  });

  // plan-wsl_support/REQ-9 (gatekeeper decision): the conversation run again in a terminal is a live entry
  it('lists a dismissed conversation that runs again in a terminal as a running entry', async () => {
    const f = fixture();
    f.files = [sessionFile(1, 'a')];
    await f.scanner.scan();
    f.files = [];
    await f.scanner.scan();
    f.scanner.dismiss('a');
    f.files = [sessionFile(5, 'a', { status: 'waiting' })];
    await f.scanner.scan();
    expect(f.changes.at(-1)).toEqual({ type: 'session', session: expect.objectContaining({ id: 'a', state: 'needs_input' }) });
    expect(f.scanner.get('a')?.state).toBe('needs_input');
  });

  it('a second dismiss of the same id gives false', async () => {
    const f = fixture();
    f.files = [sessionFile(1, 'a')];
    await f.scanner.scan();
    f.files = [];
    await f.scanner.scan();
    expect(f.scanner.dismiss('a')).toBe(true);
    expect(f.scanner.dismiss('a')).toBe(false);
  });
});

describe('ExternalSessionScanner start and stop', () => {
  // plan-claude_sessions_client/REQ-32
  it('start scans now, then every 2 seconds by default; a second start changes nothing; stop ends the scans', async () => {
    vi.useFakeTimers();
    const f = fixture();
    scanners.push(f.scanner);
    f.scanner.start();
    f.scanner.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.check.runningSessions).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1999);
    expect(f.check.runningSessions).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.check.runningSessions).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(f.check.runningSessions).toHaveBeenCalledTimes(3);
    f.scanner.stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(f.check.runningSessions).toHaveBeenCalledTimes(3);
  });

  it('the next scan comes intervalMs after the end of the previous one', async () => {
    vi.useFakeTimers();
    const f = fixture({ intervalMs: 100 });
    scanners.push(f.scanner);
    f.check.runningSessions.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve([]), 500)));
    f.scanner.start();
    await vi.advanceTimersByTimeAsync(599);
    expect(f.check.runningSessions).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.check.runningSessions).toHaveBeenCalledTimes(2);
  });

  it('keeps scanning after a failed scan', async () => {
    vi.useFakeTimers();
    const f = fixture({ intervalMs: 100 });
    scanners.push(f.scanner);
    f.check.runningSessions.mockRejectedValueOnce(new Error('boom'));
    f.files = [sessionFile(1, 'a')];
    f.scanner.start();
    await vi.advanceTimersByTimeAsync(150);
    expect(f.scanner.list().map((s) => s.id)).toEqual(['a']);
  });
});

describe('ExternalSessionScanner with the real Claude Code folder readers', () => {
  // plan-claude_sessions_client/REQ-36: a FIFO blocks whoever opens it, so a scan that finishes proves the .key file was never opened
  it('finds a live interactive session, never opens the .key files and writes nothing under the Claude Code folder', async () => {
    const claudeDir = await tempDir('ai-client-claude-');
    const procDir = await tempDir('ai-client-proc-');
    const sessionsDir = path.join(claudeDir, 'sessions');
    await mkdir(sessionsDir);
    await mkdir(path.join(procDir, '4242'));
    await writeFile(
      path.join(sessionsDir, '4242.json'),
      JSON.stringify({ pid: 4242, sessionId: 'live-1', cwd: '/home/dev/app', kind: 'interactive', status: 'busy', updatedAt: UPDATED_AT }),
    );
    execFileSync('mkfifo', [path.join(sessionsDir, '4242.0123abcd.key')]);
    await writeHistorySession(claudeDir, '-home-dev-app', 'live-1', [userEntry('Scrivi i test', '/home/dev/app')]);
    const before = await snapshotTree(claudeDir);

    const scanner = new ExternalSessionScanner({
      check: new ExternalSessionCheck({ claudeDir, procDir }),
      history: new SessionHistory({ claudeDir }),
      hostedPids: () => [],
    });
    const result = await Promise.race([scanner.scan().then(() => 'settled'), delay(1500).then(() => 'blocked')]);

    expect(result).toBe('settled');
    expect(scanner.list()).toEqual([
      { id: 'live-1', folder: '/home/dev/app', label: 'Scrivi i test', state: 'working', lastActivity: new Date(UPDATED_AT).toISOString(), external: true },
    ]);
    expect(await snapshotTree(claudeDir)).toEqual(before);
  });
});
