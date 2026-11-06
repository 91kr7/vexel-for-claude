// Tests of plan-desktop_app, batch window-tray: TrayIcon spec (REQ-12, REQ-13, REQ-14).
import { describe, expect, it, vi } from 'vitest';
import { TRAY_TOOLTIP, trayMenuTemplate } from './tray-icon.js';

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
