import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { snapshotTree, tempDir } from '../test-support.js';
import { ExternalSessionCheck } from './external-session-check.js';

let claudeDir: string;
let procDir: string;
let check: ExternalSessionCheck;
const savedConfig = process.env.CLAUDE_CONFIG_DIR;

const sessionsDir = () => path.join(claudeDir, 'sessions');
const writeSessionFile = (name: string, content: string) => writeFile(path.join(sessionsDir(), name), content);
const alive = (pid: number) => mkdir(path.join(procDir, String(pid)));
const ids = async (hostedPids: number[] = []) => [...(await check.runningSessionIds(hostedPids))].sort();

/** Resolves to 'blocked' when the check does not finish: it opened a FIFO that nobody writes. */
const settles = (promise: Promise<unknown>) =>
  Promise.race([promise.then(() => 'settled'), new Promise((resolve) => setTimeout(() => resolve('blocked'), 1500))]);

beforeEach(async () => {
  claudeDir = await tempDir('ai-client-claude-');
  procDir = await tempDir('ai-client-proc-');
  await mkdir(sessionsDir());
  check = new ExternalSessionCheck({ claudeDir, procDir });
});

afterEach(() => {
  if (savedConfig === undefined) delete process.env.CLAUDE_CONFIG_DIR;
  else process.env.CLAUDE_CONFIG_DIR = savedConfig;
});

describe('ExternalSessionCheck.runningSessionIds', () => {
  // plan-claude_sessions_client/REQ-27
  it('gives the sessionId of each <pid>.json whose process is alive and not hosted', async () => {
    await writeSessionFile('101.json', JSON.stringify({ pid: 101, sessionId: 'in-terminal', cwd: '/work/a' }));
    await writeSessionFile('102.json', JSON.stringify({ sessionId: 'also-in-terminal' }));
    await alive(101);
    await alive(102);
    expect(await ids()).toEqual(['also-in-terminal', 'in-terminal']);
  });

  it('leaves out a session whose process is not alive', async () => {
    await writeSessionFile('201.json', JSON.stringify({ sessionId: 'dead' }));
    expect(await ids()).toEqual([]);
  });

  it('leaves out a session whose process the client hosts', async () => {
    await writeSessionFile('301.json', JSON.stringify({ sessionId: 'hosted' }));
    await writeSessionFile('302.json', JSON.stringify({ sessionId: 'external' }));
    await alive(301);
    await alive(302);
    expect(await ids([301])).toEqual(['external']);
  });

  it('ignores a file with invalid JSON or without a string sessionId', async () => {
    await writeSessionFile('401.json', '{broken');
    await writeSessionFile('402.json', JSON.stringify({ sessionId: 42 }));
    await writeSessionFile('403.json', JSON.stringify({ pid: 403 }));
    await writeSessionFile('404.json', JSON.stringify({ sessionId: 'good' }));
    for (const pid of [401, 402, 403, 404]) await alive(pid);
    expect(await ids()).toEqual(['good']);
  });

  it('is empty when there is no sessions folder', async () => {
    check = new ExternalSessionCheck({ claudeDir: await tempDir('ai-client-claude-empty-'), procDir });
    expect(await ids()).toEqual([]);
  });

  it('only takes files named <digits>.json', async () => {
    for (const name of ['501.abc.key', 'abc.json', '502.json.bak', '50x.json']) await writeSessionFile(name, JSON.stringify({ sessionId: name }));
    for (const pid of [501, 502]) await alive(pid);
    expect(await ids()).toEqual([]);
  });

  // A FIFO blocks whoever opens it, so a run that finishes proves the file was never opened.
  it('never opens a <pid>.<hash>.key file', async () => {
    execFileSync('mkfifo', [path.join(sessionsDir(), '601.0123abcd.key')]);
    await writeSessionFile('602.json', JSON.stringify({ sessionId: 'visible' }));
    await alive(601);
    await alive(602);
    const result = check.runningSessionIds([]);
    expect(await settles(result)).toBe('settled');
    expect([...(await result)]).toEqual(['visible']);
  });

  it('uses the default Claude Code folder without options', async () => {
    await writeSessionFile(`${process.pid}.json`, JSON.stringify({ sessionId: 'this-process' }));
    process.env.CLAUDE_CONFIG_DIR = claudeDir;
    expect([...(await new ExternalSessionCheck().runningSessionIds([]))]).toEqual(['this-process']);
  });

  // plan-claude_sessions_client/REQ-28
  it('writes nothing under claudeDir', async () => {
    await writeSessionFile('701.json', JSON.stringify({ sessionId: 'x' }));
    await alive(701);
    const before = await snapshotTree(claudeDir);
    await ids();
    expect(await snapshotTree(claudeDir)).toEqual(before);
  });
});

describe('ExternalSessionCheck.runningSessions', () => {
  const sessions = async (hostedPids: number[] = []) => (await check.runningSessions(hostedPids)).sort((a, b) => a.pid - b.pid);

  // plan-claude_sessions_client/REQ-29
  it('gives the data of each live, not hosted <pid>.json, with the pid of the file name', async () => {
    await writeSessionFile(
      '801.json',
      JSON.stringify({ pid: 9999, sessionId: 'full', cwd: '/work/a', kind: 'interactive', status: 'busy', updatedAt: 1762333200000, extra: 'x' }),
    );
    await writeSessionFile('802.json', JSON.stringify({ sessionId: 'bare' }));
    await writeSessionFile('803.json', JSON.stringify({ sessionId: 'hosted', kind: 'interactive' }));
    await writeSessionFile('804.json', JSON.stringify({ sessionId: 'dead', kind: 'interactive' }));
    for (const pid of [801, 802, 803]) await alive(pid);
    expect(await sessions([803])).toEqual([
      { pid: 801, sessionId: 'full', cwd: '/work/a', kind: 'interactive', status: 'busy', updatedAt: 1762333200000 },
      { pid: 802, sessionId: 'bare' },
    ]);
  });

  it('leaves out cwd, kind and status that are not strings, and updatedAt that is not a number', async () => {
    await writeSessionFile('811.json', JSON.stringify({ sessionId: 'odd', cwd: 1, kind: null, status: true, updatedAt: '2026-11-05' }));
    await alive(811);
    expect(await sessions()).toEqual([{ pid: 811, sessionId: 'odd' }]);
  });

  it('ignores invalid files, and is empty without a sessions folder', async () => {
    await writeSessionFile('821.json', '{broken');
    await writeSessionFile('822.json', JSON.stringify({ sessionId: 42 }));
    await alive(821);
    await alive(822);
    expect(await sessions()).toEqual([]);
    check = new ExternalSessionCheck({ claudeDir: await tempDir('ai-client-claude-empty-'), procDir });
    expect(await sessions()).toEqual([]);
  });

  // plan-claude_sessions_client/REQ-36
  it('never opens a <pid>.<hash>.key file and writes nothing under claudeDir', async () => {
    execFileSync('mkfifo', [path.join(sessionsDir(), '831.0123abcd.key')]);
    await writeSessionFile('831.json', JSON.stringify({ sessionId: 'visible', kind: 'interactive' }));
    await alive(831);
    const before = await snapshotTree(claudeDir);
    const result = check.runningSessions([]);
    expect(await settles(result)).toBe('settled');
    expect(await result).toEqual([{ pid: 831, sessionId: 'visible', kind: 'interactive' }]);
    expect(await snapshotTree(claudeDir)).toEqual(before);
  });
});
