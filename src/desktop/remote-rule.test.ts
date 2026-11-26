import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AttentionEvent, AttentionSession } from './attention-client.js';
import { REMOTE_DELAY_MS, type RemoteSend, RemoteRule } from './remote-rule.js';

/** A clock with its own timers: `advance` moves the time and runs the timers that become due, in order. */
class FakeClock {
  time = 1_000_000;
  #nextId = 0;
  readonly timers = new Map<number, { at: number; callback: () => void }>();
  readonly delays: number[] = [];

  now = () => this.time;

  setTimer = (callback: () => void, ms: number) => {
    this.#nextId += 1;
    this.timers.set(this.#nextId, { at: this.time + ms, callback });
    this.delays.push(ms);
    return this.#nextId;
  };

  clearTimer = (timer: unknown) => {
    this.timers.delete(timer as number);
  };

  advance(ms: number): void {
    const end = this.time + ms;
    for (;;) {
      const due = [...this.timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      this.timers.delete(due[0]);
      this.time = due[1].at;
      due[1].callback();
    }
    this.time = end;
  }
}

function setup() {
  const clock = new FakeClock();
  const sends: RemoteSend[] = [];
  const sentAt: number[] = [];
  const rule = new RemoteRule({
    onSend: (send) => {
      sends.push(send);
      sentAt.push(clock.time);
    },
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });
  return { clock, rule, sends, sentAt };
}

const needsInput = (id: string, sessionId = 's1'): AttentionEvent => ({
  id,
  sessionId,
  kind: 'needs_input',
  folder: `/projects/${sessionId}`,
  label: `Label ${sessionId}`,
  waitingTool: 'Bash',
});
const listed = (...sessionIds: string[]): AttentionSession[] =>
  sessionIds.map((sessionId) => ({ sessionId, folder: `/projects/${sessionId}`, label: `Label ${sessionId}` }));

describe('RemoteRule', () => {
  it('waits 60,000 ms', () => {
    expect(REMOTE_DELAY_MS).toBe(60_000);
  });

  // plan-remote_notifications/REQ-19, REQ-28
  it('sends once, 60 seconds after a needs_input event, with the event and the time it got it', () => {
    const { clock, rule, sends, sentAt } = setup();
    const receivedAt = clock.time;
    const event = needsInput('ev-1');
    rule.receiveEvent(event);
    rule.receiveNeedsInput(listed('s1'));

    clock.advance(59_999);
    expect(sends).toEqual([]);
    clock.advance(1);
    expect(sends).toEqual([{ event, receivedAt }]);
    expect(sentAt).toEqual([receivedAt + 60_000]);
  });

  // plan-remote_notifications/REQ-21
  it('sends nothing when a needs-input list without the session comes before the 60 seconds', () => {
    const { clock, rule, sends } = setup();
    rule.receiveEvent(needsInput('ev-1'));
    rule.receiveNeedsInput(listed('s1'));
    clock.advance(30_000);
    rule.receiveNeedsInput(listed());
    clock.advance(120_000);
    expect(sends).toEqual([]);
  });

  it('keeps the count while the lists still hold the session', () => {
    const { clock, rule, sends } = setup();
    rule.receiveEvent(needsInput('ev-1'));
    for (let second = 0; second < 6; second += 1) {
      clock.advance(10_000);
      rule.receiveNeedsInput(listed('s1', 'other'));
    }
    expect(sends.map((send) => send.event.id)).toEqual(['ev-1']);
  });

  // plan-remote_notifications/REQ-22
  it('sends at most once while the session keeps needing input', () => {
    const { clock, rule, sends } = setup();
    rule.receiveEvent(needsInput('ev-1'));
    rule.receiveNeedsInput(listed('s1'));
    clock.advance(60_000);
    for (let minute = 0; minute < 5; minute += 1) {
      rule.receiveNeedsInput(listed('s1'));
      clock.advance(60_000);
    }
    expect(sends).toHaveLength(1);
  });

  // plan-remote_notifications/REQ-22: the AttentionMonitor gives one event per entry; the same event again restarts nothing
  it('ignores an event id it got before: no new count and no second send', () => {
    const { clock, rule, sends } = setup();
    const receivedAt = clock.time;
    rule.receiveEvent(needsInput('ev-1'));
    clock.advance(30_000);
    rule.receiveEvent(needsInput('ev-1'));
    clock.advance(30_000);
    expect(sends).toEqual([{ event: needsInput('ev-1'), receivedAt }]);
    rule.receiveEvent(needsInput('ev-1'));
    clock.advance(120_000);
    expect(sends).toHaveLength(1);
  });

  // plan-remote_notifications/REQ-23
  it('starts a new 60-second count when the session leaves needs input and enters it again', () => {
    const { clock, rule, sends } = setup();
    rule.receiveEvent(needsInput('ev-1'));
    clock.advance(60_000);
    rule.receiveNeedsInput(listed());
    clock.advance(5_000);

    const enteredAgain = clock.time;
    rule.receiveEvent(needsInput('ev-2'));
    rule.receiveNeedsInput(listed('s1'));
    clock.advance(59_999);
    expect(sends.map((send) => send.event.id)).toEqual(['ev-1']);
    clock.advance(1);
    expect(sends.at(-1)).toEqual({ event: needsInput('ev-2'), receivedAt: enteredAgain });
  });

  // plan-remote_notifications/REQ-21, REQ-23
  it('a new entry left before 60 seconds sends nothing, and the next one starts again from zero', () => {
    const { clock, rule, sends } = setup();
    rule.receiveEvent(needsInput('ev-1'));
    clock.advance(40_000);
    rule.receiveNeedsInput(listed());
    rule.receiveEvent(needsInput('ev-2'));
    clock.advance(40_000);
    expect(sends, 'the first count stopped; the second has run 40 s').toEqual([]);
    clock.advance(20_000);
    expect(sends.map((send) => send.event.id)).toEqual(['ev-2']);
  });

  it('a new needs_input event of a counting session replaces its count', () => {
    const { clock, rule, sends } = setup();
    rule.receiveEvent(needsInput('ev-1'));
    clock.advance(30_000);
    const secondAt = clock.time;
    rule.receiveEvent(needsInput('ev-2'));
    clock.advance(30_000);
    expect(sends).toEqual([]);
    clock.advance(30_000);
    expect(sends).toEqual([{ event: needsInput('ev-2'), receivedAt: secondAt }]);
    clock.advance(120_000);
    expect(sends).toHaveLength(1);
  });

  // plan-remote_notifications/REQ-27
  it('counts each session on its own: two waiting sessions send two notifications', () => {
    const { clock, rule, sends, sentAt } = setup();
    const start = clock.time;
    rule.receiveEvent(needsInput('ev-a', 'a'));
    clock.advance(10_000);
    rule.receiveEvent(needsInput('ev-b', 'b'));
    rule.receiveNeedsInput(listed('a', 'b'));
    clock.advance(60_000);
    expect(sends.map((send) => [send.event.sessionId, send.receivedAt])).toEqual([
      ['a', start],
      ['b', start + 10_000],
    ]);
    expect(sentAt).toEqual([start + 60_000, start + 70_000]);
  });

  // plan-remote_notifications/REQ-21, REQ-27
  it('a list without one session stops only the count of that session', () => {
    const { clock, rule, sends } = setup();
    rule.receiveEvent(needsInput('ev-a', 'a'));
    rule.receiveEvent(needsInput('ev-b', 'b'));
    clock.advance(20_000);
    rule.receiveNeedsInput(listed('b'));
    clock.advance(60_000);
    expect(sends.map((send) => send.event.sessionId)).toEqual(['b']);
  });

  // plan-remote_notifications/REQ-25
  it.each(['turn_end', 'session_end'] as const)('starts no count for a %s event', (kind) => {
    const { clock, rule, sends } = setup();
    rule.receiveEvent(kind === 'session_end' ? { ...needsInput('ev-1'), kind, error: false } : { ...needsInput('ev-1'), kind });
    clock.advance(180_000);
    expect(sends).toEqual([]);
    expect(clock.delays).toEqual([]);
  });

  // RemoteRule: turn_end and session_end start and stop nothing
  it.each(['turn_end', 'session_end'] as const)('a %s event does not stop a running count', (kind) => {
    const { clock, rule, sends } = setup();
    rule.receiveEvent(needsInput('ev-1'));
    clock.advance(10_000);
    rule.receiveEvent({ ...needsInput('ev-2'), kind });
    clock.advance(50_000);
    expect(sends.map((send) => send.event.id)).toEqual(['ev-1']);
  });

  // plan-remote_notifications/REQ-24
  it('a needs-input list alone starts no count: sessions already waiting at start send nothing', () => {
    const { clock, rule, sends } = setup();
    rule.receiveNeedsInput(listed('a', 'b'));
    clock.advance(180_000);
    rule.receiveNeedsInput(listed('a', 'b'));
    clock.advance(180_000);
    expect(sends).toEqual([]);
  });

  // plan-remote_notifications/REQ-24
  it('a session already waiting at start sends after it leaves and enters needs input again', () => {
    const { clock, rule, sends } = setup();
    rule.receiveNeedsInput(listed('s1'));
    clock.advance(120_000);
    rule.receiveNeedsInput(listed());
    rule.receiveEvent(needsInput('ev-1'));
    rule.receiveNeedsInput(listed('s1'));
    clock.advance(60_000);
    expect(sends.map((send) => send.event.id)).toEqual(['ev-1']);
  });

  it('keeps at most one timer per session', () => {
    const { clock, rule } = setup();
    rule.receiveEvent(needsInput('ev-1'));
    rule.receiveEvent(needsInput('ev-2'));
    rule.receiveEvent(needsInput('ev-3'));
    expect(clock.timers.size).toBe(1);
    expect(clock.delays).toEqual([60_000, 60_000, 60_000]);
  });
});

describe('RemoteRule default clock and timers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // plan-remote_notifications/REQ-19, REQ-28
  it('uses Date.now and setTimeout when none are given', () => {
    vi.useFakeTimers({ now: new Date('2026-11-26T10:00:00.000Z') });
    const sends: RemoteSend[] = [];
    const rule = new RemoteRule({ onSend: (send) => sends.push(send) });
    rule.receiveEvent(needsInput('ev-1'));
    vi.advanceTimersByTime(59_999);
    expect(sends).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(sends).toEqual([{ event: needsInput('ev-1'), receivedAt: Date.parse('2026-11-26T10:00:00.000Z') }]);
  });

  // plan-remote_notifications/REQ-21
  it('clears the default timer when the session leaves needs input', () => {
    vi.useFakeTimers();
    const sends: RemoteSend[] = [];
    const rule = new RemoteRule({ onSend: (send) => sends.push(send) });
    rule.receiveEvent(needsInput('ev-1'));
    vi.advanceTimersByTime(20_000);
    rule.receiveNeedsInput([]);
    vi.advanceTimersByTime(120_000);
    expect(sends).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
