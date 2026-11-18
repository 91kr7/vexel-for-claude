import { describe, expect, it } from 'vitest';
import { isHanging } from './hanging-rule.js';
import type { ProcessKind } from './process-kind.js';
import type { ProcessFacts } from './process-reader.js';
import { claude, fact, fakeClaude, server } from './processes-test-support.js';

// Unit tests of isHanging, plan-app_processes/REQ-19.
const OWN = 999;

function hanging(target: ProcessFacts, kinds: Array<[number, ProcessKind]>, facts: ProcessFacts[]): boolean {
  return isHanging(target, new Map(kinds), facts, OWN);
}

describe('isHanging', () => {
  it('is false for the own pid, whatever its launcher', () => {
    const own = server(OWN, { markers: { testServer: true, launcher: { pid: 4242, startTicks: '1' } } });
    expect(hanging(own, [[OWN, 'test-server']], [own])).toBe(false);
  });

  it.each(['app-server', 'test-server'] as const)('is false for a session whose parent is a running %s', (parentKind) => {
    const parent = server(5);
    const child = claude(20, 5, 'abc');
    expect(hanging(child, [[5, parentKind], [20, 'claude-session']], [parent, child])).toBe(false);
  });

  it('is false for a fake Claude whose parent is a running server', () => {
    const parent = server(5);
    const child = fakeClaude(20, 5);
    expect(hanging(child, [[5, 'test-server'], [20, 'fake-claude']], [parent, child])).toBe(false);
  });

  it('is true for a session whose parent is gone (reparented to init)', () => {
    const child = claude(20, 1, 'abc');
    expect(hanging(child, [[20, 'claude-session']], [child])).toBe(true);
  });

  it('is true for a fake Claude whose parent is not a server', () => {
    const shell = fact(5);
    const child = fakeClaude(20, 5);
    expect(hanging(child, [[20, 'fake-claude']], [shell, child])).toBe(true);
  });

  it('is true for a session whose parent is another session, not a server', () => {
    const parent = claude(5, 1, 'abc');
    const child = claude(20, 5, 'def');
    expect(hanging(child, [[5, 'claude-session'], [20, 'claude-session']], [parent, child])).toBe(true);
  });

  it('is false for a server without a launcher marker (started by hand)', () => {
    const other = server(10);
    expect(hanging(other, [[10, 'app-server']], [other])).toBe(false);
  });

  it.each(['app-server', 'test-server'] as const)('is false for a %s whose launcher still runs with the same start time', (kind) => {
    const launcher = fact(30, { startTicks: '777' });
    const other = server(10, { markers: { testServer: kind === 'test-server', launcher: { pid: 30, startTicks: '777' } } });
    expect(hanging(other, [[10, kind]], [launcher, other])).toBe(false);
  });

  it.each(['app-server', 'test-server'] as const)('is true for a %s whose launcher is gone', (kind) => {
    const other = server(10, { markers: { testServer: kind === 'test-server', launcher: { pid: 30, startTicks: '777' } } });
    expect(hanging(other, [[10, kind]], [other])).toBe(true);
  });

  it('is true when the launcher pid was reused by a process with another start time', () => {
    const reused = fact(30, { startTicks: '999' });
    const other = server(10, { markers: { testServer: true, launcher: { pid: 30, startTicks: '777' } } });
    expect(hanging(other, [[10, 'test-server']], [reused, other])).toBe(true);
  });
});
