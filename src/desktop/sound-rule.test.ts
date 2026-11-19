// Tests of plan-input_sound, batch needs-input-sound: SoundRule spec.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AttentionEvent } from './attention-client.js';
import { SoundRule } from './sound-rule.js';

function event(id: string, kind: AttentionEvent['kind'] = 'needs_input', sessionId = 's1'): AttentionEvent {
  return { id, sessionId, kind, folder: '/home/me/shop', label: 'Fix the cart' };
}

/** A rule on a clock that the test moves by hand. */
function ruleAt(start = 1_000_000) {
  const clock = { t: start };
  const rule = new SoundRule({ now: () => clock.t });
  return { rule, at: (ms: number) => (clock.t = start + ms) };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('SoundRule', () => {
  // plan-input_sound/REQ-1: at start no sound has played, so the first needs_input plays
  it('plays for the first needs_input event', () => {
    const { rule } = ruleAt();
    expect(rule.receiveEvent(event('e1'))).toBe(true);
  });

  // plan-input_sound/REQ-8
  it.each(['turn_end', 'session_end'] as const)('never plays for a %s event', (kind) => {
    const { rule } = ruleAt();
    expect(rule.receiveEvent(event('e1', kind))).toBe(false);
  });

  // plan-input_sound/REQ-8: an event that does not play does not start the 5000 ms window
  it.each(['turn_end', 'session_end'] as const)('a %s event does not keep the next needs_input silent', (kind) => {
    const { rule, at } = ruleAt();
    rule.receiveEvent(event('e1', kind));
    at(100);
    expect(rule.receiveEvent(event('e2'))).toBe(true);
  });

  // plan-input_sound/REQ-5: the same event id never plays twice, also after the window
  it('never plays twice for the same event id', () => {
    const { rule, at } = ruleAt();
    expect(rule.receiveEvent(event('e1'))).toBe(true);
    at(60_000);
    expect(rule.receiveEvent(event('e1'))).toBe(false);
  });

  // plan-input_sound/REQ-4: one window over every session
  it('stays silent for needs_input of other sessions within 5000 ms of a sound', () => {
    const { rule, at } = ruleAt();
    expect(rule.receiveEvent(event('e1', 'needs_input', 's1'))).toBe(true);
    at(1000);
    expect(rule.receiveEvent(event('e2', 'needs_input', 's2'))).toBe(false);
    at(4999);
    expect(rule.receiveEvent(event('e3', 'needs_input', 's3'))).toBe(false);
  });

  // SoundRule contract: "a sound played at most 5000 ms ago" includes 5000 ms
  it('stays silent exactly 5000 ms after a sound', () => {
    const { rule, at } = ruleAt();
    rule.receiveEvent(event('e1'));
    at(5000);
    expect(rule.receiveEvent(event('e2'))).toBe(false);
  });

  // plan-input_sound/REQ-6: a new entry into needs input after the window plays again, also for the same session
  it('plays again for a new event more than 5000 ms after the last sound', () => {
    const { rule, at } = ruleAt();
    rule.receiveEvent(event('e1', 'needs_input', 's1'));
    at(5001);
    expect(rule.receiveEvent(event('e2', 'needs_input', 's1'))).toBe(true);
  });

  // SoundRule invariant: only a played sound starts the window
  it('measures the window from the last played sound, not from a silent event', () => {
    const { rule, at } = ruleAt();
    rule.receiveEvent(event('e1'));
    at(4000);
    expect(rule.receiveEvent(event('e2'))).toBe(false);
    at(5001);
    expect(rule.receiveEvent(event('e3'))).toBe(true);
    at(10_000);
    expect(rule.receiveEvent(event('e4'))).toBe(false);
    at(10_002);
    expect(rule.receiveEvent(event('e5'))).toBe(true);
  });

  // SoundRule contract: an event kept silent by the window still counts as received
  it('never plays later for an event id that the window kept silent', () => {
    const { rule, at } = ruleAt();
    rule.receiveEvent(event('e1'));
    at(1000);
    expect(rule.receiveEvent(event('e2'))).toBe(false);
    at(20_000);
    expect(rule.receiveEvent(event('e2'))).toBe(false);
  });

  // SoundRule contract: the default clock is Date.now
  it('uses Date.now when no clock is given', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000_000);
    const rule = new SoundRule();
    expect(rule.receiveEvent(event('e1'))).toBe(true);
    vi.setSystemTime(1_005_000);
    expect(rule.receiveEvent(event('e2'))).toBe(false);
    vi.setSystemTime(1_005_001);
    expect(rule.receiveEvent(event('e3'))).toBe(true);
  });
});
