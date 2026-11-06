// Tests of plan-desktop_app, batch window-tray, and of plan-session_notifications, batch tray-signal: TrayIcon spec.
import { existsSync } from 'node:fs';
import type { MenuItemConstructorOptions } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import type { AttentionSession } from './attention-client.js';
import { TRAY_TOOLTIP, trayIconFile, trayMenuTemplate, trayTooltip } from './tray-icon.js';

const noActions = { openWindow: () => undefined, quit: () => undefined };
const SEPARATOR = '---';
const labels = (template: MenuItemConstructorOptions[]) => template.map((item) => (item.type === 'separator' ? SEPARATOR : item.label));
const waiting = (sessionId: string, waitingSince?: string, folder = `/projects/${sessionId}`, label = 'Task'): AttentionSession =>
  waitingSince === undefined ? { sessionId, folder, label } : { sessionId, folder, label, waitingSince };
const click = (item: MenuItemConstructorOptions | undefined) => item?.click?.({} as never, undefined, {} as never);

describe('TrayIcon', () => {
  it('has the tooltip "Vexel for Claude"', () => {
    expect(TRAY_TOOLTIP).toBe('Vexel for Claude');
  });

  it('has two items, "Open Window" then "Quit"', () => {
    const template = trayMenuTemplate({ openWindow: () => undefined, quit: () => undefined });
    expect(template.map((item) => item.label)).toEqual(['Open Window', 'Quit']);
  });

  it.each([
    ['Open Window', 'openWindow'],
    ['Quit', 'quit'],
  ] as const)('"%s" runs only the %s action', (label, action) => {
    const actions = { openWindow: vi.fn(), quit: vi.fn() };
    const item = trayMenuTemplate(actions).find((entry) => entry.label === label);
    item?.click?.({} as never, undefined, {} as never);
    expect(actions[action]).toHaveBeenCalledTimes(1);
    const other = action === 'quit' ? 'openWindow' : 'quit';
    expect(actions[other]).not.toHaveBeenCalled();
  });
});

describe('TrayIcon tooltip and icon', () => {
  // plan-session_notifications/REQ-32: with no session waiting the tooltip stays as today
  it('says "Vexel for Claude" when no session needs input', () => {
    expect(trayTooltip(0)).toBe('Vexel for Claude');
  });

  // plan-session_notifications/REQ-32: singular
  it('says "1 session needs input" for one session', () => {
    expect(trayTooltip(1)).toBe('Vexel for Claude · 1 session needs input');
  });

  // plan-session_notifications/REQ-32: plural
  it.each([2, 3, 12])('says "%i sessions need input" for more sessions', (count) => {
    expect(trayTooltip(count)).toBe(`Vexel for Claude · ${count} sessions need input`);
  });

  // plan-session_notifications/REQ-30
  it('uses the AppIcon with no session that needs input, and the AttentionIcon with one or more', () => {
    expect(trayIconFile(0)).toBe('vexel-for-claude.png');
    expect([1, 2, 7].map(trayIconFile)).toEqual(['vexel-for-claude-attention.png', 'vexel-for-claude-attention.png', 'vexel-for-claude-attention.png']);
  });

  // TrayIcon: both icon files are in the icons folder of the desktop app
  it('names icon files that exist in the icons folder', () => {
    for (const file of [trayIconFile(0), trayIconFile(1)]) expect(existsSync(new URL(`./icons/${file}`, import.meta.url)), file).toBe(true);
  });
});

describe('TrayIcon menu of the waiting sessions', () => {
  // plan-session_notifications/REQ-33, REQ-37: session entries, a separator, then "Open Window" and "Quit"
  it('has one entry "<folder name> · <label>" per waiting session, then a separator, then "Open Window" and "Quit"', () => {
    const sessions = [
      waiting('s1', '2026-11-06T10:00:00.000Z', '/home/me/projects/ai-client', 'Fix the login form'),
      waiting('s2', '2026-11-06T10:01:00.000Z', '/srv/billing/', 'Review the invoices'),
    ];

    expect(labels(trayMenuTemplate(noActions, sessions))).toEqual([
      'ai-client · Fix the login form',
      'billing · Review the invoices',
      SEPARATOR,
      'Open Window',
      'Quit',
    ]);
  });

  // TrayIcon: with no waiting session, no separator
  it('has only "Open Window" and "Quit", with no separator, for an empty list', () => {
    expect(labels(trayMenuTemplate(noActions, []))).toEqual(['Open Window', 'Quit']);
  });

  // TrayIcon: an "&" is doubled so the menu does not read it as an access key
  it('doubles each "&" of the folder name and of the label', () => {
    const template = trayMenuTemplate(noActions, [waiting('s1', '2026-11-06T10:00:00.000Z', '/projects/R&D', 'Tom & Jerry & co')]);
    expect(template[0]?.label).toBe('R&&D · Tom && Jerry && co');
  });

  // plan-session_notifications/REQ-34: a session entry runs openSession with its id
  it('runs only the openSession action with the session id when a session entry is clicked', () => {
    const actions = { openWindow: vi.fn(), quit: vi.fn(), openSession: vi.fn() };
    const template = trayMenuTemplate(actions, [waiting('s1', '2026-11-06T10:00:00.000Z'), waiting('s2', '2026-11-06T10:01:00.000Z')]);

    click(template[1]);

    expect(actions.openSession).toHaveBeenCalledTimes(1);
    expect(actions.openSession).toHaveBeenCalledWith('s2');
    expect(actions.openWindow).not.toHaveBeenCalled();
    expect(actions.quit).not.toHaveBeenCalled();
  });

  // plan-session_notifications/REQ-37: "Open Window" and "Quit" keep their actions and stay last
  it.each([
    ['Open Window', 'openWindow'],
    ['Quit', 'quit'],
  ] as const)('keeps "%s" as one of the last two items, running only %s, while sessions wait', (label, action) => {
    const actions = { openWindow: vi.fn(), quit: vi.fn(), openSession: vi.fn() };
    const template = trayMenuTemplate(actions, [waiting('s1', '2026-11-06T10:00:00.000Z')]);

    expect(labels(template.slice(-2))).toEqual(['Open Window', 'Quit']);
    click(template.find((item) => item.label === label));

    expect(actions[action]).toHaveBeenCalledTimes(1);
    expect(actions.openSession).not.toHaveBeenCalled();
    expect(actions[action === 'quit' ? 'openWindow' : 'quit']).not.toHaveBeenCalled();
  });

  // plan-session_notifications/REQ-35: the longest waiting first
  it('orders the entries by waitingSince, earliest first, whatever the list order', () => {
    const sessions = [
      waiting('late', '2026-11-06T10:05:00.000Z'),
      waiting('early', '2026-11-06T10:01:00.000Z'),
      waiting('middle', '2026-11-06T10:03:00.000Z'),
    ];

    expect(labels(trayMenuTemplate(noActions, sessions)).slice(0, 3)).toEqual(['early · Task', 'middle · Task', 'late · Task']);
  });

  // plan-session_notifications/REQ-35: the order is by time, not by text
  it('compares the waitingSince times as times, also with a time zone offset', () => {
    const sessions = [waiting('utc', '2026-11-06T10:00:00.000Z'), waiting('offset', '2026-11-06T11:00:00+02:00')];

    expect(labels(trayMenuTemplate(noActions, sessions)).slice(0, 2)).toEqual(['offset · Task', 'utc · Task']);
  });

  // TrayIcon: equal times keep the order of the list
  it('keeps the list order for equal times', () => {
    const sessions = [waiting('second', '2026-11-06T10:00:00.000Z'), waiting('first', '2026-11-06T10:00:00.000Z')];

    expect(labels(trayMenuTemplate(noActions, sessions)).slice(0, 2)).toEqual(['second · Task', 'first · Task']);
  });

  // TrayIcon: entries with no waitingSince, or one that is not a valid time, come last in list order
  it('puts the entries with no waitingSince or an invalid one after the timed ones, in list order', () => {
    const sessions = [
      waiting('none-1'),
      waiting('invalid', 'not a time'),
      waiting('timed-late', '2026-11-06T10:05:00.000Z'),
      waiting('empty', ''),
      waiting('timed-early', '2026-11-06T10:01:00.000Z'),
      waiting('none-2'),
    ];

    expect(labels(trayMenuTemplate(noActions, sessions))).toEqual([
      'timed-early · Task',
      'timed-late · Task',
      'none-1 · Task',
      'invalid · Task',
      'empty · Task',
      'none-2 · Task',
      SEPARATOR,
      'Open Window',
      'Quit',
    ]);
  });
});
