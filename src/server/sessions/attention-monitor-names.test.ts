import { describe, expect, it, vi } from 'vitest';
import { ExternalSessionScanner } from '../external/external-session-scanner.js';
import type { RunningSessionFile } from '../history/external-session-check.js';
import { type AttentionEvent, type AttentionSession, AttentionMonitor } from './attention-monitor.js';
import { SessionNameStore } from './session-name-store.js';
import { SessionStateTracker } from './session-state-tracker.js';

const waitingFile: RunningSessionFile = {
  pid: 202,
  sessionId: 'ext-1',
  cwd: '/home/dev/nightly',
  kind: 'interactive',
  status: 'waiting',
  updatedAt: Date.parse('2026-11-06T10:00:00.000Z'),
};

async function fixture(initial: [string, string][] = []) {
  const names = new SessionNameStore(undefined, initial);
  const tracker = new SessionStateTracker({ names });
  const files: RunningSessionFile[] = [];
  const scanner = new ExternalSessionScanner({
    check: { runningSessions: vi.fn(async () => files.map((f) => ({ ...f }))) } as never,
    history: { get: vi.fn(async () => undefined) } as never,
    hostedPids: () => [],
    names,
  });
  const monitor = new AttentionMonitor({ tracker, scanner, turns: { lastTurn: async () => ({ interrupted: false }) } });
  const events: AttentionEvent[] = [];
  const lists: AttentionSession[][] = [];
  monitor.onEvent((event) => events.push(event));
  monitor.onNeedsInputChange((sessions) => lists.push(sessions));
  tracker.track({ id: 'h1', cwd: '/projects/ai-client', onExit: () => {} });
  tracker.applyHookEvent('h1', { hook_event_name: 'UserPromptSubmit', prompt: 'Fix the login form' });
  return { names, tracker, scanner, files, monitor, events, lists };
}

describe('AttentionMonitor with session names', () => {
  // plan-session_list_improvements/REQ-27, REQ-28: the event and the needs-input list carry the name of a hosted session
  it('gives the name of a hosted session in its needs-input event and in the needs-input list', async () => {
    const f = await fixture();
    await f.names.set('h1', 'Release fix');
    f.tracker.applyHookEvent('h1', { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
    expect(f.events.map((e) => [e.kind, e.label])).toEqual([['needs_input', 'Release fix']]);
    expect(f.monitor.needsInput().map((s) => [s.sessionId, s.folder, s.label])).toEqual([['h1', '/projects/ai-client', 'Release fix']]);
  });

  // plan-session_list_improvements/REQ-28, REQ-37: a rename while the session waits updates the list the tray reads
  it('changes the needs-input list when a waiting hosted session is renamed', async () => {
    const f = await fixture();
    f.tracker.applyHookEvent('h1', { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
    expect(f.monitor.needsInput().map((s) => s.label)).toEqual(['Fix the login form']);
    f.lists.length = 0;

    await f.names.set('h1', 'Release fix');

    expect(f.monitor.needsInput().map((s) => s.label)).toEqual(['Release fix']);
    expect(f.lists.at(-1)?.map((s) => s.label)).toEqual(['Release fix']);
  });

  // plan-session_list_improvements/REQ-27, REQ-28: the same for an external session
  it('gives the name of an external session in its event and the needs-input list, and follows a rename', async () => {
    const f = await fixture([['ext-1', 'Terminal job']]);
    // first sight is not a transition: the session is seen idle, then waiting
    f.files.push({ ...waitingFile, status: 'idle' });
    await f.scanner.scan();
    f.files[0] = waitingFile;
    await f.scanner.scan();
    const event = f.events.find((e) => e.sessionId === 'ext-1');
    expect(event?.kind).toBe('needs_input');
    expect(event?.label).toBe('Terminal job');
    expect(f.monitor.needsInput().find((s) => s.sessionId === 'ext-1')?.label).toBe('Terminal job');

    await f.names.set('ext-1', 'Nightly job');

    expect(f.monitor.needsInput().find((s) => s.sessionId === 'ext-1')?.label).toBe('Nightly job');
  });
});
