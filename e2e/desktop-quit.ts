// Quits the desktop app of an Electron spec, and stops every process it started (knowledge base `tests-stop-their-processes`).
import { type ChildProcess, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { ElectronApplication } from '@playwright/test';

/** Start time of process `pid` (field 22 of its stat), so that a reused PID is not taken for it. */
function startTimeOf(pid: number): string | undefined {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19];
  } catch {
    return undefined;
  }
}

function processTreeOf(root: number): { pid: number; start: string }[] {
  const childrenOf = new Map<number, number[]>();
  for (const row of execFileSync('ps', ['-e', '-o', 'pid=,ppid='], { encoding: 'utf8' }).trim().split('\n')) {
    const [pid, ppid] = row.trim().split(/\s+/).map(Number) as [number, number];
    childrenOf.set(ppid, [...(childrenOf.get(ppid) ?? []), pid]);
  }
  const tree: { pid: number; start: string }[] = [];
  for (const queue = [...(childrenOf.get(root) ?? [])]; queue.length > 0; ) {
    const pid = queue.shift()!;
    const start = startTimeOf(pid);
    if (start !== undefined) tree.push({ pid, start });
    queue.push(...(childrenOf.get(pid) ?? []));
  }
  return tree;
}

// "Quit" (answer 1 to the busy-session confirmation), SIGKILL after `waitMs`, then SIGKILL by PID to each process it started still alive.
// Not `app.close()`, and no process left: one holding Electron's descriptors (Playwright's connection too) keeps close() or the worker teardown waiting.
export async function quitDesktop(app: ElectronApplication, waitMs = 10_000): Promise<void> {
  let electron: ChildProcess;
  try {
    electron = app.process();
  } catch {
    return;
  }
  if (electron.exitCode !== null || electron.signalCode !== null) return;
  const started = electron.pid === undefined ? [] : processTreeOf(electron.pid);
  const exited = new Promise<void>((resolve) => electron.once('exit', () => resolve()));
  await app
    .evaluate(({ dialog }) => {
      dialog.showMessageBox = (() => Promise.resolve({ response: 1, checkboxChecked: false })) as never;
    })
    .catch(() => undefined);
  await app.evaluate(({ app: electronApp }) => electronApp.quit()).catch(() => undefined);
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, waitMs))]);
  if (electron.exitCode === null && electron.signalCode === null) electron.kill('SIGKILL');
  for (const { pid, start } of started) {
    try {
      if (startTimeOf(pid) === start) process.kill(pid, 'SIGKILL');
    } catch {
      // It exited between the check and the signal.
    }
  }
}
