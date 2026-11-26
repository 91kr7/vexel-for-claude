// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, rerenderLast, unmountAll } from '../settings/settings-test-support';
import { ElapsedTime, useNow } from './ElapsedTime';

const NOW = Date.parse('2026-11-26T10:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const timeOf = (host: HTMLElement) => host.querySelector('time');

function Now() {
  return <output>{useNow()}</output>;
}
const nowOf = (host: HTMLElement) => Number(host.querySelector('output')?.textContent);

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
  unmountAll();
  vi.useRealTimers();
});

describe('ElapsedTime', () => {
  // plan-session_activity/REQ-8: a <time> element with the moment and the short time since it
  it('shows a <time> with dateTime = since and the short duration since it', () => {
    const since = ago(42_000);
    const host = mount(<ElapsedTime since={since} className="extra" />);
    const time = timeOf(host);
    expect(time?.getAttribute('datetime')).toBe(since);
    expect(time?.textContent).toBe('42 s');
    expect(time?.classList.contains('extra')).toBe(true);
    expect(host.textContent).toBe('42 s');
  });

  // plan-session_activity/REQ-15: the hour form
  it('shows "1 h 05 min" for a moment 65 minutes ago', () => {
    expect(timeOf(mount(<ElapsedTime since={ago(65 * 60_000)} />))?.textContent).toBe('1 h 05 min');
  });

  // elapsed-time spec: since not a valid time → nothing
  it('shows nothing for a time that is not valid', () => {
    const host = mount(<ElapsedTime since="not a time" />);
    expect(host.innerHTML).toBe('');
  });

  // elapsed-time spec: a time after now shows "0 s"
  it('shows "0 s" for a time after now', () => {
    expect(timeOf(mount(<ElapsedTime since={new Date(NOW + 90_000).toISOString()} />))?.textContent).toBe('0 s');
  });

  // plan-session_activity/REQ-9: the time counts up once per second
  it('counts up every second with no new props', async () => {
    const host = mount(<ElapsedTime since={ago(0)} />);
    expect(timeOf(host)?.textContent).toBe('0 s');
    await vi.advanceTimersByTimeAsync(1000);
    expect(timeOf(host)?.textContent).toBe('1 s');
    await vi.advanceTimersByTimeAsync(41_000);
    expect(timeOf(host)?.textContent).toBe('42 s');
    await vi.advanceTimersByTimeAsync(138_000);
    expect(timeOf(host)?.textContent).toBe('3 min');
  });

  // elapsed-time spec: one shared timer refreshes every shown time at the same moment
  it('refreshes every shown time from one shared timer, at the same moment', async () => {
    const first = mount(<ElapsedTime since={ago(5_000)} />);
    const second = mount(<ElapsedTime since={ago(59_500)} />);
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount(), 'one timer for two shown times').toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(timeOf(first)?.textContent).toBe('6 s');
    expect(timeOf(second)?.textContent).toBe('1 min');
  });

  // elapsed-time spec: the timer runs only while a time is shown
  it('runs no timer when no time is shown', async () => {
    mount(<ElapsedTime since={ago(5_000)} />);
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(1);
    unmountAll();
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount(), 'no timer after the last time goes').toBe(0);
    mount(<ElapsedTime since={ago(5_000)} />);
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount(), 'the timer starts again with a new time').toBe(1);
  });

  // elapsed-time spec: a new since shows its text at once
  it('shows the text of a new since at once', () => {
    const host = mount(<ElapsedTime since={ago(10_000)} />);
    expect(timeOf(host)?.textContent).toBe('10 s');
    rerenderLast(<ElapsedTime since={ago(180_000)} />);
    expect(timeOf(host)?.textContent).toBe('3 min');
    expect(timeOf(host)?.getAttribute('datetime')).toBe(ago(180_000));
  });
});

describe('useNow', () => {
  // elapsed-time spec and plan-session_activity/REQ-21: the current time, refreshed by the shared timer at the same moment as every ElapsedTime
  it('gives the current time, refreshed by the one shared timer together with ElapsedTime', async () => {
    const clock = mount(<Now />);
    const time = mount(<ElapsedTime since={ago(5_000)} />);
    expect(nowOf(clock)).toBe(NOW);
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount(), 'one timer for useNow and ElapsedTime').toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(nowOf(clock)).toBe(NOW + 1000);
    expect(timeOf(time)?.textContent).toBe('6 s');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(nowOf(clock)).toBe(NOW + 61_000);
  });

  // elapsed-time spec: the timer runs only while an ElapsedTime or a useNow is mounted
  it('keeps the timer running for a useNow alone, and stops it when it goes', async () => {
    mount(<Now />);
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(1);
    unmountAll();
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
