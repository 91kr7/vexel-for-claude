// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProcessesResult, ProcessRow } from './processes-client';
import { ProcessesSection } from './ProcessesSection';
import { mount, run, unmountAll } from './settings-test-support';

// Unit tests of the "Processes" section, plan-app_processes/REQ-10 to REQ-19, REQ-21: a fake load stands in for the route.
const NOW = 1_800_000_000_000;
const OWN: ProcessRow = { kind: 'test-server', pid: 101, startedAt: NOW - 42_000, port: 3100, thisInstance: true, hosted: false, hanging: false };
const OTHER: ProcessRow = { kind: 'app-server', pid: 102, startedAt: NOW - 2 * 3600_000 - 5 * 60_000, port: 4001, thisInstance: false, hosted: false, hanging: false };
const SESSION: ProcessRow = {
  kind: 'claude-session',
  pid: 103,
  startedAt: NOW - 5 * 60_000,
  folder: '/home/me/project',
  label: 'Fix the bug',
  thisInstance: false,
  hosted: true,
  hanging: false,
};
const LEFTOVER: ProcessRow = { kind: 'fake-claude', pid: 104, startedAt: NOW - 3 * 86_400_000 - 4 * 3600_000, thisInstance: false, hosted: false, hanging: true };

afterEach(unmountAll);

/** A load that stays pending until `finish` is called; `signals` holds the signal of each call. */
function heldLoad() {
  const finishers: Array<(result: ProcessesResult) => void> = [];
  const held = {
    signals: [] as Array<AbortSignal | undefined>,
    finish: (result: ProcessesResult, index = finishers.length - 1) => run(() => finishers[index]?.(result)),
    load: vi.fn((signal?: AbortSignal) => {
      held.signals.push(signal);
      return new Promise<ProcessesResult>((resolve) => finishers.push(resolve));
    }),
  };
  return held;
}

const render = (load: (signal?: AbortSignal) => Promise<ProcessesResult>) => mount(<ProcessesSection load={load} now={() => NOW} />);
const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
const refresh = (host: HTMLElement) => [...host.querySelectorAll('button')].find((button) => text(button) === 'Refresh') as HTMLButtonElement;
const region = (host: HTMLElement) => host.querySelector<HTMLElement>('[role="region"][aria-label="Process List"]');
const rows = (host: HTMLElement) => [...host.querySelectorAll('[aria-label="Processes"] > li')];
const until = (check: () => boolean) => vi.waitFor(() => expect(check()).toBe(true));
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function loaded(processes: ProcessRow[]) {
  const held = heldLoad();
  const host = render(held.load);
  held.finish({ status: 'loaded', processes });
  await until(() => host.querySelector('[role="status"]') === null);
  return { host, held };
}

describe('ProcessesSection', () => {
  // spec ProcessesSection: header "Processes" with "Refresh", body the region "Process List"
  it('shows the title "Processes", the action "Refresh" and the region "Process List"', () => {
    const host = render(heldLoad().load);
    expect(text(host.querySelector('h1, h2, h3, h4'))).toBe('Processes');
    expect(refresh(host)).toBeDefined();
    expect(region(host)).not.toBeNull();
  });

  // plan-app_processes/REQ-10: one load on mount
  it('loads once on mount and shows "Loading processes…" meanwhile', () => {
    const held = heldLoad();
    const host = render(held.load);
    expect(held.load).toHaveBeenCalledTimes(1);
    expect(text(host.querySelector('[role="status"]'))).toContain('Loading processes…');
  });

  it('shows "Could not load the processes." when the load fails', async () => {
    const held = heldLoad();
    const host = render(held.load);
    held.finish({ status: 'failed' });
    await until(() => text(host.querySelector('[role="alert"]'))?.includes('Could not load the processes.') ?? false);
    expect(host.querySelector('[role="status"]')).toBeNull();
  });

  // plan-app_processes/REQ-12
  it('says "No app processes are running." in one line when the list is empty', async () => {
    const { host } = await loaded([]);
    expect(text(region(host))).toBe('No app processes are running.');
    expect(rows(host)).toHaveLength(0);
  });

  // plan-app_processes/REQ-13, REQ-14, REQ-17
  it('shows one row per process, in the order of the server', async () => {
    const { host } = await loaded([OWN, OTHER, LEFTOVER, SESSION]);
    const pids = rows(host).map((row) => /PID (\d+)/.exec(row.textContent ?? '')?.[1]);
    expect(pids).toEqual(['101', '102', '104', '103']);
  });

  it('shows the kind, "This instance", the PID, the port and the running time of the current instance', async () => {
    const { host } = await loaded([OWN]);
    const row = text(rows(host)[0]) ?? '';
    for (const part of ['Test server', 'This instance', 'PID 101', 'Port 3100', 'Running 42s']) expect(row).toContain(part);
    expect(row).not.toContain('Hosted here');
    expect(row).not.toContain('Hanging');
  });

  it('shows an app server with its port and "Running 2h 05m", without marks', async () => {
    const { host } = await loaded([OTHER]);
    const row = text(rows(host)[0]) ?? '';
    for (const part of ['App server', 'PID 102', 'Port 4001', 'Running 2h 05m']) expect(row).toContain(part);
    for (const mark of ['This instance', 'Hosted here', 'Hanging']) expect(row).not.toContain(mark);
  });

  // plan-app_processes/REQ-15, REQ-16, REQ-18
  it('shows a hosted session with its label, folder and "Hosted here"', async () => {
    const { host } = await loaded([SESSION]);
    const row = text(rows(host)[0]) ?? '';
    for (const part of ['Claude session', 'Hosted here', 'Fix the bug', 'PID 103', 'Running 5m', '/home/me/project']) expect(row).toContain(part);
    expect(row).not.toContain('Port');
  });

  // plan-app_processes/REQ-19
  it('shows a hanging fake Claude with "Hanging" and no port, folder or label', async () => {
    const { host } = await loaded([LEFTOVER]);
    const row = text(rows(host)[0]) ?? '';
    for (const part of ['Fake Claude', 'Hanging', 'PID 104', 'Running 3d 4h']) expect(row).toContain(part);
    expect(row).not.toContain('Port');
    expect(row).not.toContain('undefined');
  });

  // plan-app_processes/REQ-11
  it('"Refresh" loads again and shows the loading state until the new load ends', async () => {
    const { host, held } = await loaded([OWN]);
    run(() => refresh(host).click());
    expect(held.load).toHaveBeenCalledTimes(2);
    expect(text(host.querySelector('[role="status"]'))).toContain('Loading processes…');
    held.finish({ status: 'loaded', processes: [OWN, SESSION] });
    await until(() => rows(host).length === 2);
  });

  it('"Refresh" aborts a load still running, and its late answer changes nothing', async () => {
    const held = heldLoad();
    const host = render(held.load);
    run(() => refresh(host).click());
    expect(held.signals[0]?.aborted).toBe(true);
    held.finish({ status: 'loaded', processes: [OWN, OTHER, SESSION] }, 1);
    await until(() => rows(host).length === 3);
    held.finish({ status: 'loaded', processes: [OWN] }, 0);
    await flush();
    expect(rows(host)).toHaveLength(3);
  });

  it('ignores a load that ends after unmount', async () => {
    const held = heldLoad();
    render(held.load);
    unmountAll();
    held.finish({ status: 'loaded', processes: [OWN] });
    await flush();
    expect(document.body.innerHTML).toBe('');
  });

  // plan-app_processes/REQ-10, REQ-20: no load on a timer
  it('loads on no timer while it stays open', async () => {
    vi.useFakeTimers();
    try {
      const held = heldLoad();
      render(held.load);
      held.finish({ status: 'loaded', processes: [OWN] });
      await vi.advanceTimersByTimeAsync(5 * 60_000);
      expect(held.load).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  // plan-app_processes/REQ-21: "Refresh" and the region are Tab stops
  it('makes "Refresh" a button and the "Process List" region a Tab stop', async () => {
    const { host } = await loaded([OWN]);
    expect(refresh(host).tagName).toBe('BUTTON');
    expect(refresh(host).disabled).toBe(false);
    expect(region(host)?.tabIndex).toBe(0);
  });
});
