// @vitest-environment jsdom
// Unit tests of useTurnEndSignal and turnEndedInRepository (plan-git_explorer, batch refresh).
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionState, SessionSummary } from '../sessions/live-session-store';
import { turnEndedInRepository, useTurnEndSignal } from './turn-end-watcher';

const ROOT = '/home/dev/progetto';

const session = (id: string, folder: string, state: SessionState, external = false): SessionSummary => ({
  id,
  folder,
  label: id,
  state,
  lastActivity: '2026-11-10T10:00:00Z',
  ...(external ? { external: true as const } : {}),
});

describe('turnEndedInRepository', () => {
  // plan-git_explorer/REQ-25
  it.each([
    ['at the repository root', ROOT],
    ['in a subfolder of the root', `${ROOT}/frontend`],
    ['in a deep subfolder of the root', `${ROOT}/frontend/src/app`],
    ['at the root with a trailing slash', `${ROOT}/`],
  ])('is true for a session going from working to idle %s', (_name, folder) => {
    expect(turnEndedInRepository([session('b', folder, 'working')], [session('b', folder, 'idle')], ROOT)).toBe(true);
  });

  it('is true when the root has a trailing slash', () => {
    expect(turnEndedInRepository([session('b', ROOT, 'working')], [session('b', ROOT, 'idle')], `${ROOT}/`)).toBe(true);
  });

  it('counts an external session the same as a hosted one', () => {
    const folder = `${ROOT}/frontend`;
    expect(turnEndedInRepository([session('x', folder, 'working', true)], [session('x', folder, 'idle', true)], ROOT)).toBe(true);
  });

  it.each([
    ['a sibling folder sharing the prefix', '/home/dev/progetto-two'],
    ['the parent folder', '/home/dev'],
    ['an unrelated folder', '/tmp/other'],
  ])('is false for a session in %s', (_name, folder) => {
    expect(turnEndedInRepository([session('b', folder, 'working')], [session('b', folder, 'idle')], ROOT)).toBe(false);
  });

  it.each<[string, SessionState, SessionState]>([
    ['working to needs_input', 'working', 'needs_input'],
    ['working to ended', 'working', 'ended'],
    ['idle to idle', 'idle', 'idle'],
    ['needs_input to idle', 'needs_input', 'idle'],
    ['idle to working', 'idle', 'working'],
  ])('is false for a change from %s', (_name, before, after) => {
    expect(turnEndedInRepository([session('b', ROOT, before)], [session('b', ROOT, after)], ROOT)).toBe(false);
  });

  it('is false for a session that appears already idle', () => {
    expect(turnEndedInRepository([], [session('b', ROOT, 'idle')], ROOT)).toBe(false);
  });

  it('is false for a working session that leaves the list', () => {
    expect(turnEndedInRepository([session('b', ROOT, 'working')], [], ROOT)).toBe(false);
  });

  it('matches sessions by id, not by position', () => {
    const previous = [session('a', ROOT, 'idle'), session('b', ROOT, 'working')];
    const next = [session('b', ROOT, 'idle'), session('a', ROOT, 'idle')];
    expect(turnEndedInRepository(previous, next, ROOT)).toBe(true);
  });

  it('does not match a working session with another id that is now idle', () => {
    expect(turnEndedInRepository([session('a', ROOT, 'working')], [session('a', ROOT, 'working'), session('b', ROOT, 'idle')], ROOT)).toBe(false);
  });

  it('is true when at least one of several sessions ends a turn in the repository', () => {
    const previous = [session('a', '/tmp/other', 'working'), session('b', `${ROOT}/x`, 'working')];
    const next = [session('a', '/tmp/other', 'idle'), session('b', `${ROOT}/x`, 'idle')];
    expect(turnEndedInRepository(previous, next, ROOT)).toBe(true);
  });
});

const roots: Root[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
});

function Probe({ sessions, root, onTurnEnd }: { sessions: readonly SessionSummary[]; root: string | undefined; onTurnEnd: () => void }) {
  useTurnEndSignal(sessions, root, onTurnEnd);
  return null;
}

function mount(sessions: readonly SessionSummary[], ...args: [] | [string | undefined]) {
  const root = args.length === 0 ? ROOT : args[0];
  const onTurnEnd = vi.fn();
  const r = createRoot(document.createElement('div'));
  roots.push(r);
  flushSync(() => r.render(<Probe sessions={sessions} root={root} onTurnEnd={onTurnEnd} />));
  return {
    onTurnEnd,
    set: (next: readonly SessionSummary[], nextRoot: string | undefined = root) =>
      flushSync(() => r.render(<Probe sessions={next} root={nextRoot} onTurnEnd={onTurnEnd} />)),
  };
}

describe('useTurnEndSignal', () => {
  // plan-git_explorer/REQ-25
  it('signals once when a session of the repository goes from working to idle', () => {
    const probe = mount([session('b', `${ROOT}/frontend`, 'working')]);
    probe.set([session('b', `${ROOT}/frontend`, 'idle')]);
    expect(probe.onTurnEnd).toHaveBeenCalledTimes(1);
  });

  it('gives no signal for the first list seen, even with an idle session', () => {
    const probe = mount([session('b', ROOT, 'idle')]);
    expect(probe.onTurnEnd).not.toHaveBeenCalled();
  });

  it('signals again at each later turn end', () => {
    const probe = mount([session('b', ROOT, 'working')]);
    probe.set([session('b', ROOT, 'idle')]);
    probe.set([session('b', ROOT, 'working')]);
    probe.set([session('b', ROOT, 'idle')]);
    expect(probe.onTurnEnd).toHaveBeenCalledTimes(2);
  });

  it('compares each list with the last one seen, so an idle list seen twice gives one signal', () => {
    const probe = mount([session('b', ROOT, 'working')]);
    probe.set([session('b', ROOT, 'idle')]);
    probe.set([session('b', ROOT, 'idle', false)]);
    expect(probe.onTurnEnd).toHaveBeenCalledTimes(1);
  });

  it('gives no signal for a session outside the repository', () => {
    const probe = mount([session('b', '/tmp/other', 'working')]);
    probe.set([session('b', '/tmp/other', 'idle')]);
    expect(probe.onTurnEnd).not.toHaveBeenCalled();
  });

  it('gives no signal while the root is undefined', () => {
    const probe = mount([session('b', ROOT, 'working')], undefined);
    probe.set([session('b', ROOT, 'idle')], undefined);
    expect(probe.onTurnEnd).not.toHaveBeenCalled();
  });
});
