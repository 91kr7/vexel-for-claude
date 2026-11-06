import { describe, expect, it, vi } from 'vitest';
import type { RunningSessionFile } from '../history/external-session-check.js';
import { SessionNameStore } from '../sessions/session-name-store.js';
import { type ExternalSessionChange, ExternalSessionScanner } from './external-session-scanner.js';

const file = (pid: number, sessionId: string): RunningSessionFile => ({
  pid,
  sessionId,
  cwd: `/home/dev/${sessionId}`,
  kind: 'interactive',
  status: 'idle',
  updatedAt: Date.parse('2026-11-05T08:30:00.000Z'),
});

function fixture(initial: [string, string][] = []) {
  const names = new SessionNameStore(undefined, initial);
  const files = [file(101, 'ext-1')];
  const check = { runningSessions: vi.fn(async () => files.map((f) => ({ ...f }))) };
  const history = {
    get: vi.fn(async (id: string) => ({ id, folder: `/home/dev/${id}`, firstUserMessage: 'Run the nightly job', lastModified: new Date() })),
  };
  const scanner = new ExternalSessionScanner({ check: check as never, history: history as never, hostedPids: () => [], names });
  const changes: ExternalSessionChange[] = [];
  scanner.onChange((change) => changes.push(change));
  return { names, check, scanner, changes };
}

const labelOf = (change: ExternalSessionChange | undefined) => (change?.type === 'session' ? change.session.label : undefined);

describe('ExternalSessionScanner with names', () => {
  // plan-session_list_improvements/REQ-25
  it('labels an entry with the name of its id', async () => {
    const f = fixture([['ext-1', 'Terminal job']]);
    await f.scanner.scan();
    expect(f.scanner.get('ext-1')?.label).toBe('Terminal job');
    expect(labelOf(f.changes[0])).toBe('Terminal job');
  });

  // plan-session_list_improvements/REQ-37: a rename goes out at once, with no scan
  it('notifies the new label of a listed entry at once, with no scan', async () => {
    const f = fixture();
    await f.scanner.scan();
    expect(f.scanner.get('ext-1')?.label).toBe('Run the nightly job');
    const scans = f.check.runningSessions.mock.calls.length;
    f.changes.length = 0;

    await f.names.set('ext-1', 'Terminal job');

    expect(f.check.runningSessions.mock.calls.length).toBe(scans);
    expect(f.changes).toHaveLength(1);
    expect(f.changes[0]).toMatchObject({ type: 'session', session: { id: 'ext-1', label: 'Terminal job', external: true } });
    expect(f.scanner.get('ext-1')?.label).toBe('Terminal job');
    expect(f.scanner.list().map((s) => s.label)).toEqual(['Terminal job']);
  });

  // plan-session_list_improvements/REQ-31
  it('brings back the default label when the name is removed', async () => {
    const f = fixture([['ext-1', 'Terminal job']]);
    await f.scanner.scan();
    f.changes.length = 0;
    await f.names.set('ext-1', '');
    expect(f.changes.map(labelOf)).toEqual(['Run the nightly job']);
    expect(f.scanner.get('ext-1')?.label).toBe('Run the nightly job');
  });

  it('notifies nothing for a name change of an id that is not listed', async () => {
    const f = fixture();
    await f.scanner.scan();
    f.changes.length = 0;
    await f.names.set('not-listed', 'Other');
    expect(f.changes).toEqual([]);
  });

  it('notifies nothing on the next scan of the same data after a rename', async () => {
    const f = fixture();
    await f.scanner.scan();
    await f.names.set('ext-1', 'Terminal job');
    f.changes.length = 0;
    await f.scanner.scan();
    expect(f.changes).toEqual([]);
    expect(f.scanner.get('ext-1')?.label).toBe('Terminal job');
  });
});
