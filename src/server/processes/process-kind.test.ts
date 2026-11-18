import { describe, expect, it } from 'vitest';
import { classifyProcesses } from './process-kind.js';
import { APP, APP_DIR, FAKE, claude, fact, fakeClaude, server } from './processes-test-support.js';

// Unit tests of classifyProcesses, plan-app_processes/REQ-2, REQ-3, REQ-4, REQ-5, REQ-7.
const OWN = 999;
const classify = (...facts: ReturnType<typeof fact>[]) => classifyProcesses(facts, { appName: APP, ownPid: OWN });

describe('classifyProcesses', () => {
  // plan-app_processes/REQ-2
  it('gives app-server to a node process that runs src/server/main.ts from the app folder', () => {
    expect(classify(server(10)).get(10)).toBe('app-server');
  });

  it.each([
    ['nodejs as argv[0]', ['/usr/bin/nodejs', 'src/server/main.ts']],
    ['an absolute path to main.ts', ['node', '--import', 'tsx', '/home/me/ai-client/src/server/main.ts']],
  ])('gives app-server with %s', (_name, argv) => {
    expect(classify(server(10, { argv })).get(10)).toBe('app-server');
  });

  it('does not list a server whose folder holds another package', () => {
    expect(classify(server(10, { cwdPackageName: 'other-app' })).has(10)).toBe(false);
  });

  it('does not list a server whose folder has no package name', () => {
    expect(classify(server(10, { cwdPackageName: undefined })).has(10)).toBe(false);
  });

  it('does not list a process that is not node, even when it names src/server/main.ts', () => {
    expect(classify(server(10, { argv: ['/usr/bin/python3', 'src/server/main.ts'] })).has(10)).toBe(false);
  });

  it('does not list a node process that runs another file', () => {
    expect(classify(server(10, { argv: ['node', 'src/server/other.ts'] })).has(10)).toBe(false);
  });

  // spec classifyProcesses: a launcher (tsx) whose child is also a server is not listed
  it('lists only the inner server of a launcher chain', () => {
    const kinds = classify(server(10), server(11, { ppid: 10 }));
    expect(kinds.has(10)).toBe(false);
    expect(kinds.get(11)).toBe('app-server');
  });

  // plan-app_processes/REQ-3
  it('gives test-server to a server with the test marker', () => {
    expect(classify(server(10, { markers: { testServer: true } })).get(10)).toBe('test-server');
  });

  it.each([FAKE, 'test-support/fake-claude.mjs'])('gives test-server to a server whose claude CLI is the fake one "%s"', (claudeCli) => {
    expect(classify(server(10, { markers: { testServer: false, claudeCli } })).get(10)).toBe('test-server');
  });

  it('keeps app-server for a server whose claude CLI is another program', () => {
    expect(classify(server(10, { markers: { testServer: false, claudeCli: '/usr/bin/claude' } })).get(10)).toBe('app-server');
  });

  it('gives the own pid its server kind, also when its arguments do not match', () => {
    expect(classify(fact(OWN)).get(OWN)).toBe('app-server');
    expect(classify(fact(OWN, { markers: { testServer: true } })).get(OWN)).toBe('test-server');
  });

  it('gives test-server to an Electron instance of the app with the test environment', () => {
    const electron = fact(10, { argv: ['/home/me/ai-client/node_modules/electron/dist/electron', '.'], cwd: APP_DIR, cwdPackageName: APP, markers: { testServer: true } });
    expect(classify(electron).get(10)).toBe('test-server');
  });

  it('does not list an Electron instance of the app without the test environment', () => {
    const electron = fact(10, { argv: ['electron', '.'], cwd: APP_DIR, cwdPackageName: APP });
    expect(classify(electron).has(10)).toBe(false);
  });

  it('does not list an Electron helper process (--type=...)', () => {
    const helper = fact(10, { argv: ['electron', '--type=renderer'], cwd: APP_DIR, cwdPackageName: APP, markers: { testServer: true } });
    expect(classify(helper).has(10)).toBe(false);
  });

  // plan-app_processes/REQ-4
  it('gives fake-claude to a process that runs test-support/fake-claude.mjs', () => {
    expect(classify(server(5), fakeClaude(20, 5)).get(20)).toBe('fake-claude');
  });

  it('gives fake-claude with a relative fake CLI path and no session id', () => {
    expect(classify(fact(20, { argv: ['node', 'test-support/fake-claude.mjs'] })).get(20)).toBe('fake-claude');
  });

  // plan-app_processes/REQ-5
  it('gives claude-session to the top process with a session id', () => {
    expect(classify(server(5), claude(20, 5, 'abc')).get(20)).toBe('claude-session');
  });

  it('does not list the descendants of a session that keep its session id', () => {
    const kinds = classify(server(5), claude(20, 5, 'abc'), claude(21, 20, 'abc'), claude(22, 21, 'abc'));
    expect(kinds.get(20)).toBe('claude-session');
    expect(kinds.has(21)).toBe(false);
    expect(kinds.has(22)).toBe(false);
  });

  it('lists a child with another session id as its own session', () => {
    expect(classify(claude(20, 5, 'abc'), claude(21, 20, 'def')).get(21)).toBe('claude-session');
  });

  // plan-app_processes/REQ-7
  it('does not list a Claude process without a session id', () => {
    expect(classify(claude(30, 1, undefined)).has(30)).toBe(false);
  });

  it('does not list an unrelated process', () => {
    expect(classify(fact(40)).has(40)).toBe(false);
  });
});
