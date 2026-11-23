import { describe, expect, it, vi } from 'vitest';
import { ProcessList } from './process-list.js';
import type { ProcessFacts } from './process-reader.js';
import { APP, claude, fact, fakeClaude, server } from './processes-test-support.js';

// Unit tests of ProcessList, plan-app_processes/REQ-6, REQ-13 to REQ-18, REQ-20: a fake reader stands in for /proc.
const OWN = 999;

function fakeReader(facts: ProcessFacts[], ports: Record<number, number[]> = {}) {
  return {
    readProcesses: vi.fn(async () => facts),
    readListeningPorts: vi.fn(async (pids: Iterable<number>) => {
      const map = new Map<number, number[]>();
      // The reader gives each pid's ports sorted.
      for (const pid of pids) if (ports[pid]) map.set(pid, [...ports[pid]].sort((x, y) => x - y));
      return map;
    }),
  };
}

function listOf(reader: ReturnType<typeof fakeReader>, hosted: number[] = [], labels: Record<string, string> = {}) {
  return new ProcessList({
    reader,
    registry: { hostedPids: () => hosted },
    tracker: { get: (id: string) => (labels[id] === undefined ? undefined : { label: labels[id] }) },
    ownPid: OWN,
    appName: APP,
  });
}

const own = server(OWN, { startedAt: 5000 });

describe('ProcessList', () => {
  // plan-app_processes/REQ-13, REQ-14, REQ-17
  it('gives the current instance with kind, pid, start time, lowest port and "this instance"', async () => {
    const rows = await listOf(fakeReader([own], { [OWN]: [4001, 3100] })).list();
    expect(rows).toEqual([{ kind: 'app-server', pid: OWN, startedAt: 5000, port: 3100, thisInstance: true, hosted: false, hanging: false }]);
  });

  it('gives a server with no listening socket no port', async () => {
    const rows = await listOf(fakeReader([own])).list();
    expect(rows[0]).not.toHaveProperty('port');
  });

  // plan-app_processes/REQ-2, REQ-6: another app server, unknown to this one
  it('lists another app server with its port, not as this instance', async () => {
    const other = server(10, { startedAt: 100 });
    const rows = await listOf(fakeReader([own, other], { 10: [3000] })).list();
    expect(rows.find((row) => row.pid === 10)).toMatchObject({ kind: 'app-server', port: 3000, thisInstance: false, hanging: false });
  });

  // spec ProcessList: ports are read only for the server rows
  it('reads ports only for the server rows', async () => {
    const reader = fakeReader([own, server(10), fakeClaude(20, OWN), claude(30, OWN, 'abc'), fact(40)]);
    await listOf(reader).list();
    const asked = reader.readListeningPorts.mock.calls.flatMap(([pids]) => [...pids]).sort((a, b) => a - b);
    expect(asked).toEqual([10, OWN]);
  });

  // plan-app_processes/REQ-15, REQ-16, REQ-18
  it('gives a hosted session its folder, its label and "hosted", and no port', async () => {
    const session = claude(30, OWN, 'abc', { cwd: '/home/me/project' });
    const rows = await listOf(fakeReader([own, session], { 30: [9999] }), [30], { abc: 'Fix the bug' }).list();
    expect(rows.find((row) => row.pid === 30)).toEqual({
      kind: 'claude-session',
      pid: 30,
      startedAt: session.startedAt,
      folder: '/home/me/project',
      label: 'Fix the bug',
      thisInstance: false,
      hosted: true,
      hanging: false,
    });
  });

  it('gives a session no label when the tracker does not know it', async () => {
    const rows = await listOf(fakeReader([own, claude(30, OWN, 'abc')]), [30]).list();
    expect(rows.find((row) => row.pid === 30)).not.toHaveProperty('label');
  });

  it('gives a session no folder when its working directory is unknown', async () => {
    const rows = await listOf(fakeReader([own, claude(30, OWN, 'abc', { cwd: undefined })]), [30]).list();
    expect(rows.find((row) => row.pid === 30)).not.toHaveProperty('folder');
  });

  it('gives a server no folder', async () => {
    const rows = await listOf(fakeReader([own])).list();
    expect(rows[0]).not.toHaveProperty('folder');
  });

  // plan-app_processes/REQ-18: a session of another server is not hosted here
  it('marks a session not hosted when its pid is not in hostedPids', async () => {
    const other = server(10);
    const rows = await listOf(fakeReader([own, other, claude(30, 10, 'abc')]), []).list();
    expect(rows.find((row) => row.pid === 30)).toMatchObject({ hosted: false, hanging: false });
  });

  // plan-app_processes/REQ-6, REQ-19: a leftover session whose server is gone
  it('lists a leftover session whose server is gone, marked hanging', async () => {
    const rows = await listOf(fakeReader([own, claude(30, 1, 'abc')])).list();
    expect(rows.find((row) => row.pid === 30)).toMatchObject({ kind: 'claude-session', hosted: false, hanging: true });
  });

  it('does not list processes that are not app processes', async () => {
    const rows = await listOf(fakeReader([own, fact(40), claude(41, 1, undefined)])).list();
    expect(rows.map((row) => row.pid)).toEqual([OWN]);
  });

  // spec ProcessList: order
  it('puts this instance first, then app servers, test servers, fake Claude, sessions; oldest first, then lower pid', async () => {
    const facts = [
      claude(70, OWN, 'b', { startedAt: 10 }),
      fakeClaude(60, OWN, { startedAt: 50 }),
      claude(71, OWN, 'a', { startedAt: 5 }),
      server(50, { startedAt: 30, markers: { testServer: true } }),
      server(41, { startedAt: 20 }),
      server(40, { startedAt: 20 }),
      server(42, { startedAt: 1 }),
      fakeClaude(61, OWN, { startedAt: 40 }),
      server(OWN, { startedAt: 99_999 }),
    ];
    const rows = await listOf(fakeReader(facts)).list();
    expect(rows.map((row) => row.pid)).toEqual([OWN, 42, 40, 41, 50, 61, 60, 71, 70]);
  });

  // spec ProcessList: a call never gets the rows of a read that started before it (TD-1)
  it('gives a call during a read the rows of the next read, shared by the calls that arrived meanwhile', async () => {
    const releases: ((facts: ProcessFacts[]) => void)[] = [];
    const reader = fakeReader([]);
    reader.readProcesses.mockImplementation(() => new Promise<ProcessFacts[]>((resolve) => releases.push(resolve)));
    const list = listOf(reader);
    const first = list.list();
    const second = list.list();
    const third = list.list();
    expect(reader.readProcesses).toHaveBeenCalledTimes(1);
    releases[0]?.([own, server(42, { startedAt: 1 })]);
    expect((await first).map((row) => row.pid)).toEqual([OWN, 42]);
    await vi.waitFor(() => expect(reader.readProcesses).toHaveBeenCalledTimes(2));
    releases[1]?.([own]);
    const [b, c] = await Promise.all([second, third]);
    expect(reader.readProcesses).toHaveBeenCalledTimes(2);
    expect(b).toEqual(c);
    expect(b.map((row) => row.pid)).toEqual([OWN]);
  });

  it('gives a call during a failed read the rows of the next read', async () => {
    let fail: (error: Error) => void = () => {};
    const reader = fakeReader([own]);
    reader.readProcesses.mockImplementationOnce(() => new Promise<ProcessFacts[]>((_, reject) => (fail = reject)));
    const list = listOf(reader);
    const first = list.list();
    const second = list.list();
    fail(new Error('EACCES'));
    await expect(first).rejects.toThrow();
    expect((await second).map((row) => row.pid)).toEqual([OWN]);
  });

  it('starts a new read for a call after the previous read ended', async () => {
    const reader = fakeReader([own]);
    const list = listOf(reader);
    await list.list();
    await list.list();
    expect(reader.readProcesses).toHaveBeenCalledTimes(2);
  });

  // plan-app_processes/REQ-20: no read without a call
  it('does not read before a call, nor after one ends', async () => {
    vi.useFakeTimers();
    try {
      const reader = fakeReader([own]);
      const list = listOf(reader);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(reader.readProcesses).not.toHaveBeenCalled();
      await list.list();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(reader.readProcesses).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects when the read fails, and a later call reads again', async () => {
    const reader = fakeReader([own]);
    reader.readProcesses.mockRejectedValueOnce(new Error('EACCES'));
    const list = listOf(reader);
    await expect(list.list()).rejects.toThrow();
    expect((await list.list()).map((row) => row.pid)).toEqual([OWN]);
  });
});
