import { type ChildProcess, spawn } from 'node:child_process';
import { mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { tempDir, waitFor } from '../test-support.js';
import { ProcessReader } from './process-reader.js';

// Unit tests of ProcessReader, plan-app_processes/REQ-6, REQ-8, REQ-9, REQ-20:
// a fake /proc tree for the parsing rules, the real /proc for ownership and live ports.
const BTIME = 1_700_000_000;
const dirs: string[] = [];
const children: ChildProcess[] = [];
const servers: net.Server[] = [];

afterEach(async () => {
  for (const child of children.splice(0)) if (child.pid !== undefined && child.exitCode === null) process.kill(child.pid, 'SIGKILL');
  for (const server of servers.splice(0)) await new Promise((resolve) => server.close(resolve));
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

interface FakeProcess {
  pid: number;
  ppid?: number;
  comm?: string;
  startTicks?: string;
  argv?: string[];
  cwd?: string;
  env?: Record<string, string>;
  /** Socket inodes in its fd folder. */
  sockets?: number[];
  noStat?: boolean;
  noCmdline?: boolean;
  noEnviron?: boolean;
  noFd?: boolean;
}

async function fakeProc(processes: FakeProcess[], tcp: string[] = [], tcp6: string[] = []): Promise<string> {
  const root = await tempDir('ai-client-proc-');
  dirs.push(root);
  await writeFile(path.join(root, 'stat'), `cpu  1 2 3 4\nbtime ${BTIME}\nprocesses 10\n`);
  await mkdir(path.join(root, 'net'));
  const header = '  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode\n';
  await writeFile(path.join(root, 'net', 'tcp'), header + tcp.join('\n') + '\n');
  await writeFile(path.join(root, 'net', 'tcp6'), header + tcp6.join('\n') + '\n');
  await mkdir(path.join(root, 'self'));
  for (const fake of processes) {
    const dir = path.join(root, String(fake.pid));
    await mkdir(dir);
    const middle = Array.from({ length: 17 }, () => '0').join(' ');
    if (!fake.noStat)
      await writeFile(path.join(dir, 'stat'), `${fake.pid} (${fake.comm ?? 'node'}) S ${fake.ppid ?? 1} ${middle} ${fake.startTicks ?? '500'} 0 0 0\n`);
    if (!fake.noCmdline) await writeFile(path.join(dir, 'cmdline'), (fake.argv ?? ['node']).map((arg) => `${arg}\0`).join(''));
    if (fake.cwd) await symlink(fake.cwd, path.join(dir, 'cwd'));
    if (!fake.noEnviron)
      await writeFile(path.join(dir, 'environ'), Object.entries(fake.env ?? { HOME: '/home/me' }).map(([key, value]) => `${key}=${value}\0`).join(''));
    if (!fake.noFd) {
      await mkdir(path.join(dir, 'fd'));
      await symlink('/dev/null', path.join(dir, 'fd', '0'));
      for (const [index, inode] of (fake.sockets ?? []).entries()) await symlink(`socket:[${inode}]`, path.join(dir, 'fd', String(index + 3)));
    }
  }
  return root;
}

/** One line of /proc/net/tcp: `state` 0A is LISTEN, 01 is ESTABLISHED. */
const tcpLine = (port: number, inode: number, state = '0A') =>
  `   0: 0100007F:${port.toString(16).toUpperCase().padStart(4, '0')} 00000000:0000 ${state} 00000000:00000000 00:00000000 00000000  1000        0 ${inode} 1 0000000000000000 100 0 0 10 0`;
const tcp6Line = (port: number, inode: number, state = '0A') =>
  `   0: 00000000000000000000000001000000:${port.toString(16).toUpperCase().padStart(4, '0')} 00000000000000000000000000000000:0000 ${state} 00000000:00000000 00:00000000 00000000  1000        0 ${inode} 1 0000000000000000 100 0 0 10 0`;

const reader = (procDir: string) => new ProcessReader({ procDir });

describe('ProcessReader.readProcesses on a fake /proc', () => {
  it('gives pid, ppid, start ticks, start time and arguments', async () => {
    const proc = await fakeProc([{ pid: 42, ppid: 7, startTicks: '12345', argv: ['node', '--import', 'tsx', 'src/server/main.ts'] }]);
    const [facts] = await reader(proc).readProcesses();
    expect(facts).toMatchObject({ pid: 42, ppid: 7, startTicks: '12345', argv: ['node', '--import', 'tsx', 'src/server/main.ts'] });
    expect(facts?.startedAt).toBe(BTIME * 1000 + 123_450);
  });

  it('reads the fields after a command name with spaces and parentheses', async () => {
    const proc = await fakeProc([{ pid: 42, ppid: 7, comm: 'my (odd) name', startTicks: '300' }]);
    const [facts] = await reader(proc).readProcesses();
    expect(facts).toMatchObject({ pid: 42, ppid: 7, startTicks: '300' });
  });

  it('gives the working directory and the name of its package.json', async () => {
    const app = await tempDir('ai-client-cwd-');
    dirs.push(app);
    await writeFile(path.join(app, 'package.json'), JSON.stringify({ name: 'ai-client', version: '1.0.0' }));
    const proc = await fakeProc([{ pid: 42, cwd: app }]);
    const [facts] = await reader(proc).readProcesses();
    expect(facts?.cwd).toBe(app);
    expect(facts?.cwdPackageName).toBe('ai-client');
  });

  it('gives no package name when the folder has no package.json', async () => {
    const folder = await tempDir('ai-client-cwd-');
    dirs.push(folder);
    const proc = await fakeProc([{ pid: 42, cwd: folder }]);
    const [facts] = await reader(proc).readProcesses();
    expect(facts?.cwd).toBe(folder);
    expect(facts?.cwdPackageName).toBeUndefined();
  });

  it('gives no working directory when it cannot be read', async () => {
    const proc = await fakeProc([{ pid: 42 }]);
    const [facts] = await reader(proc).readProcesses();
    expect(facts?.pid).toBe(42);
    expect(facts?.cwd).toBeUndefined();
  });

  it('reads the four app markers of the environment and keeps no other variable', async () => {
    const env = {
      HOME: '/home/me',
      AI_CLIENT_SESSION_ID: 'abc-123',
      AI_CLIENT_LAUNCHER: '4242:98765',
      AI_CLIENT_TEST_SERVER: '1',
      AI_CLIENT_CLAUDE_CLI: '/x/test-support/fake-claude.mjs',
      SECRET_TOKEN: 'hidden',
    };
    const proc = await fakeProc([{ pid: 42, env }]);
    const [facts] = await reader(proc).readProcesses();
    expect(facts?.markers).toEqual({
      sessionId: 'abc-123',
      launcher: { pid: 4242, startTicks: '98765' },
      testServer: true,
      claudeCli: '/x/test-support/fake-claude.mjs',
    });
    expect(JSON.stringify(facts)).not.toContain('hidden');
  });

  it.each(['', '0', 'yes', 'true'])('gives testServer false when AI_CLIENT_TEST_SERVER is "%s"', async (value) => {
    const proc = await fakeProc([{ pid: 42, env: { AI_CLIENT_TEST_SERVER: value } }]);
    const [facts] = await reader(proc).readProcesses();
    expect(facts?.markers.testServer).toBe(false);
  });

  it.each(['4242', '4242:', ':98765', 'abc:123', '4242:98765:1', '42 42:1'])('gives no launcher for the value "%s"', async (value) => {
    const proc = await fakeProc([{ pid: 42, env: { AI_CLIENT_LAUNCHER: value } }]);
    const [facts] = await reader(proc).readProcesses();
    expect(facts?.markers.launcher).toBeUndefined();
  });

  it('gives no markers when the environment cannot be read', async () => {
    const proc = await fakeProc([{ pid: 42, noEnviron: true }]);
    const [facts] = await reader(proc).readProcesses();
    expect(facts?.pid).toBe(42);
    expect(facts?.markers).toEqual({ testServer: false });
  });

  // spec ProcessReader: a process that ends during the read is skipped
  it('skips a process whose stat or cmdline cannot be read', async () => {
    const proc = await fakeProc([{ pid: 41, noStat: true }, { pid: 42 }, { pid: 43, noCmdline: true }]);
    expect((await reader(proc).readProcesses()).map((facts) => facts.pid)).toEqual([42]);
  });

  it('reads only the numeric entries of the folder', async () => {
    const proc = await fakeProc([{ pid: 42 }]);
    expect((await reader(proc).readProcesses()).map((facts) => facts.pid)).toEqual([42]);
  });

  // plan-app_processes/REQ-8
  it('skips processes owned by another user', async () => {
    const proc = await fakeProc([{ pid: 42 }]);
    const otherUid = (process.getuid?.() ?? 1000) + 1;
    expect(await new ProcessReader({ procDir: proc, uid: otherUid }).readProcesses()).toEqual([]);
  });
});

describe('ProcessReader.readListeningPorts on a fake /proc', () => {
  it('gives the sorted TCP ports in LISTEN state of each pid, from tcp and tcp6', async () => {
    const proc = await fakeProc(
      [
        { pid: 42, sockets: [1001, 1002, 1003] },
        { pid: 43, sockets: [2001] },
      ],
      [tcpLine(4001, 1001), tcpLine(3000, 1003), tcpLine(5555, 2001, '01')],
      [tcp6Line(3100, 1002)],
    );
    const ports = await reader(proc).readListeningPorts([42, 43]);
    expect(ports.get(42)).toEqual([3000, 3100, 4001]);
    expect(ports.has(43)).toBe(false);
  });

  it('gives no entry for a pid whose fd folder cannot be read', async () => {
    const proc = await fakeProc([{ pid: 42, noFd: true }], [tcpLine(4001, 1001)]);
    expect((await reader(proc).readListeningPorts([42])).has(42)).toBe(false);
  });

  it('gives no entry for a socket inode of another process', async () => {
    const proc = await fakeProc([{ pid: 42, sockets: [9] }], [tcpLine(4001, 1001)]);
    expect((await reader(proc).readListeningPorts([42])).has(42)).toBe(false);
  });
});

describe('ProcessReader on the real /proc', () => {
  // plan-app_processes/REQ-8: only the processes of the current user
  it('lists the own process and only processes of the current user', async () => {
    const facts = await new ProcessReader().readProcesses();
    const own = facts.find((entry) => entry.pid === process.pid);
    expect(own).toMatchObject({ pid: process.pid, ppid: process.ppid, cwd: process.cwd() });
    if (process.getuid?.() !== 0) expect(facts.some((entry) => entry.pid === 1)).toBe(false);
  });

  it('reads the markers of a child started with them', async () => {
    const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], {
      env: { ...process.env, AI_CLIENT_SESSION_ID: 'real-1', AI_CLIENT_TEST_SERVER: '1', AI_CLIENT_LAUNCHER: '7:8' },
      stdio: 'ignore',
    });
    children.push(child);
    await waitFor(() => child.pid !== undefined, 'the child starts');
    const facts = (await new ProcessReader().readProcesses()).find((entry) => entry.pid === child.pid);
    expect(facts?.ppid).toBe(process.pid);
    expect(facts?.markers).toMatchObject({ sessionId: 'real-1', testServer: true, launcher: { pid: 7, startTicks: '8' } });
  });

  it('gives the port this process listens on', async () => {
    const server = net.createServer();
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as net.AddressInfo;
    const ports = await new ProcessReader().readListeningPorts([process.pid]);
    expect(ports.get(process.pid)).toContain(port);
  });
});
