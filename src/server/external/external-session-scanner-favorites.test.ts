import { describe, expect, it, vi } from 'vitest';
import type { RunningSessionFile } from '../history/external-session-check.js';
import { SessionFavoriteStore } from '../sessions/session-favorite-store.js';
import { type ExternalSessionChange, ExternalSessionScanner } from './external-session-scanner.js';

const file = (pid: number, sessionId: string): RunningSessionFile => ({
  pid,
  sessionId,
  cwd: `/home/dev/${sessionId}`,
  kind: 'interactive',
  status: 'idle',
  updatedAt: Date.parse('2026-11-05T08:30:00.000Z'),
});

function fixture(initial: string[] = []) {
  const favorites = new SessionFavoriteStore(undefined, initial);
  const files = [file(101, 'ext-1'), file(102, 'ext-2')];
  const check = { runningSessions: vi.fn(async () => files.map((f) => ({ ...f }))) };
  const history = {
    get: vi.fn(async (id: string) => ({ id, folder: `/home/dev/${id}`, firstUserMessage: 'Run the nightly job', lastModified: new Date() })),
  };
  const scanner = new ExternalSessionScanner({ check: check as never, history: history as never, hostedPids: () => [], favorites });
  const changes: ExternalSessionChange[] = [];
  scanner.onChange((change) => changes.push(change));
  return { favorites, check, scanner, changes };
}

const favoriteOf = (change: ExternalSessionChange | undefined) => (change?.type === 'session' ? change.session.favorite : undefined);

describe('ExternalSessionScanner with favorites', () => {
  // plan-favorite_session/REQ-3: an entry whose id is marked has favorite: true, the others have no field
  it('marks the entry whose id is marked, and only that one', async () => {
    const f = fixture(['ext-1']);
    await f.scanner.scan();
    expect(f.scanner.get('ext-1')?.favorite).toBe(true);
    expect(f.scanner.get('ext-2')).not.toHaveProperty('favorite');
    expect(f.scanner.list().map((s) => s.favorite)).toEqual([true, undefined]);
    expect(f.changes.map(favoriteOf)).toEqual([true, undefined]);
  });

  // plan-favorite_session/REQ-8: a change goes out at once, with no scan
  it('notifies a mark of a listed entry at once, with no scan', async () => {
    const f = fixture();
    await f.scanner.scan();
    const scans = f.check.runningSessions.mock.calls.length;
    f.changes.length = 0;

    await f.favorites.set('ext-1', true);

    expect(f.check.runningSessions.mock.calls.length).toBe(scans);
    expect(f.changes).toHaveLength(1);
    expect(f.changes[0]).toMatchObject({ type: 'session', session: { id: 'ext-1', favorite: true, external: true } });
    expect(f.scanner.get('ext-1')?.favorite).toBe(true);
  });

  // plan-favorite_session/REQ-5, REQ-8
  it('notifies the removal of the mark, and the entry has no favorite field any more', async () => {
    const f = fixture(['ext-1']);
    await f.scanner.scan();
    f.changes.length = 0;
    await f.favorites.set('ext-1', false);
    expect(f.changes).toHaveLength(1);
    expect(f.changes[0]).toMatchObject({ type: 'session', session: { id: 'ext-1' } });
    expect(favoriteOf(f.changes[0])).toBeUndefined();
    expect(f.scanner.get('ext-1')).not.toHaveProperty('favorite');
  });

  // plan-favorite_session/REQ-9: the mark changes nothing else of the entry
  it('keeps label, state and last activity when the mark changes', async () => {
    const f = fixture();
    await f.scanner.scan();
    const before = { ...f.scanner.get('ext-1') };
    await f.favorites.set('ext-1', true);
    expect(f.scanner.get('ext-1')).toEqual({ ...before, favorite: true });
  });

  it('notifies nothing for the mark of an id that is not listed', async () => {
    const f = fixture();
    await f.scanner.scan();
    f.changes.length = 0;
    await f.favorites.set('not-listed', true);
    expect(f.changes).toEqual([]);
  });

  it('keeps the mark of an entry across the next scan, with no notification', async () => {
    const f = fixture();
    await f.scanner.scan();
    await f.favorites.set('ext-1', true);
    f.changes.length = 0;
    await f.scanner.scan();
    expect(f.scanner.get('ext-1')?.favorite).toBe(true);
    expect(f.changes).toEqual([]);
  });
});
