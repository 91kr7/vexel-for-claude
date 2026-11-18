// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewerVersion } from '../newer-version/newer-version-loader';
import { SettingsDialog, type SettingsTab } from './SettingsDialog';
import { keydown, labelOf, lookStore, mount, radios, rerenderLast, run, themeStore, unmountAll } from './settings-test-support';

afterEach(unmountAll);

function open(initialTab?: SettingsTab, onClose = vi.fn(), onNewerVersion?: (version: NewerVersion) => void) {
  const theme = themeStore('dark');
  const look = lookStore('vexel');
  mount(
    <SettingsDialog initialTab={initialTab} onClose={onClose} themeStore={theme.store} lookStore={look.store} onNewerVersion={onNewerVersion} />,
  );
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]') as HTMLElement;
  return { dialog, onClose, theme, look };
}

const tabs = (dialog: HTMLElement) => [...dialog.querySelectorAll<HTMLElement>('[role="tab"]')];
const tab = (dialog: HTMLElement, name: string) => tabs(dialog).find((element) => element.textContent === name) as HTMLElement;
const visiblePanels = (dialog: HTMLElement) => [...dialog.querySelectorAll<HTMLElement>('[role="tabpanel"]')].filter((panel) => !panel.hidden);
const shownLegends = (dialog: HTMLElement) => [...(visiblePanels(dialog)[0]?.querySelectorAll('legend') ?? [])].map((legend) => legend.textContent);
const shownList = (dialog: HTMLElement) => visiblePanels(dialog)[0]?.querySelector<HTMLElement>('[role="region"][aria-label="Shortcut List"]') ?? null;
const buttonNamed = (dialog: HTMLElement, text: string) =>
  [...dialog.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.trim() === text) as HTMLButtonElement;

describe('SettingsDialog', () => {
  // plan-settings_dialog/REQ-5, REQ-19: a modal dialog titled "Settings", class settings-dialog, never shortcuts-panel
  it('is a modal dialog titled "Settings" with the class settings-dialog and not shortcuts-panel', () => {
    const { dialog } = open();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const title = document.getElementById(dialog.getAttribute('aria-labelledby') ?? '');
    expect(title?.textContent).toBe('Settings');
    expect(dialog.classList.contains('settings-dialog')).toBe(true);
    expect(dialog.classList.contains('shortcuts-panel')).toBe(false);
  });

  // spec SettingsDialog: no primary action, the footer has "Close" only
  it('has no "Save" or "Cancel" button, and a "Close" button', () => {
    const { dialog } = open();
    const texts = [...dialog.querySelectorAll('button')].map((button) => button.textContent?.trim());
    expect(texts).toContain('Close');
    expect(texts).not.toContain('Save');
    expect(texts).not.toContain('Cancel');
    expect(dialog.querySelector('.modal-actions')?.querySelectorAll('button')).toHaveLength(1);
  });

  // plan-settings_dialog/REQ-53, REQ-54, plan-app_processes/REQ-1: "Processes" comes after "Updates"
  it('has a vertical menu "Settings sections" with "Appearance", "Shortcuts", "Updates" and "Processes", in this order', () => {
    const { dialog } = open();
    const menu = dialog.querySelector('[role="tablist"]');
    expect(menu?.getAttribute('aria-label')).toBe('Settings sections');
    expect(menu?.getAttribute('aria-orientation')).toBe('vertical');
    expect(tabs(dialog).map((element) => element.textContent)).toEqual(['Appearance', 'Shortcuts', 'Updates', 'Processes']);
  });

  // plan-settings_dialog/REQ-4, REQ-53: default menu "Appearance", selected and focused on open, with the theme and look sections
  it('opens on "Appearance" by default, with the focus on it and only its panel shown: "Theme", then "Window Look"', () => {
    const { dialog } = open();
    const appearance = tab(dialog, 'Appearance');
    expect(appearance.getAttribute('aria-selected')).toBe('true');
    expect(tab(dialog, 'Shortcuts').getAttribute('aria-selected')).toBe('false');
    expect(document.activeElement).toBe(appearance);
    expect(visiblePanels(dialog)).toHaveLength(1);
    expect(visiblePanels(dialog)[0]?.getAttribute('aria-labelledby')).toBe(appearance.id);
    expect(shownLegends(dialog)).toEqual(['Theme', 'Window Look']);
  });

  // spec SettingsDialog: each panel has a header with the menu title
  it.each([
    ['appearance', 'Appearance'],
    ['shortcuts', 'Shortcuts'],
    ['updates', 'Updates'],
    ['processes', 'Processes'],
  ] as const)('shows the title of the %s menu in its panel header', (start, title) => {
    const { dialog } = open(start);
    expect(visiblePanels(dialog)[0]?.querySelector('h1, h2, h3, h4')?.textContent).toBe(title);
  });

  // plan-settings_dialog/REQ-25, spec SettingsDialog Props: initialTab "shortcuts" opens on the "Shortcuts" tab, with the shortcuts section only
  it('opens on the "Shortcuts" tab when initialTab is "shortcuts", with the shortcut list shown', () => {
    const { dialog } = open('shortcuts');
    const shortcuts = tab(dialog, 'Shortcuts');
    expect(shortcuts.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(shortcuts);
    expect(visiblePanels(dialog)).toHaveLength(1);
    expect(visiblePanels(dialog)[0]?.getAttribute('aria-labelledby')).toBe(shortcuts.id);
    expect(shownList(dialog)?.tabIndex, 'the "Shortcut List" region is a Tab stop').toBe(0);
    expect(radios(visiblePanels(dialog)[0] as HTMLElement)).toHaveLength(0);
  });

  // plan-settings_dialog/REQ-21: a click on "Shortcuts" shows the shortcuts section, which has no frame, title or "Close" of its own
  it('a click on "Shortcuts" shows the shortcuts section inside the popup, with one "Close" only', () => {
    const { dialog } = open();
    run(() => tab(dialog, 'Shortcuts').click());
    expect(tab(dialog, 'Shortcuts').getAttribute('aria-selected')).toBe('true');
    expect(shownList(dialog)).not.toBeNull();
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(document.querySelector('.shortcuts-panel')).toBeNull();
    expect([...dialog.querySelectorAll('button')].filter((button) => button.textContent?.trim() === 'Close')).toHaveLength(1);
  });

  // spec SettingsDialog, Actions: a click on a menu item shows its menu
  it('a click on "Shortcuts" shows the shortcut list, a click on "Appearance" brings the theme and look sections back', () => {
    const { dialog } = open();
    run(() => tab(dialog, 'Shortcuts').click());
    expect(tab(dialog, 'Shortcuts').getAttribute('aria-selected')).toBe('true');
    expect(shownLegends(dialog)).toEqual([]);
    run(() => tab(dialog, 'Appearance').click());
    expect(shownLegends(dialog)).toEqual(['Theme', 'Window Look']);
  });

  // plan-settings_dialog/REQ-11: the tab list is one Tab stop, the shown tab
  it('gives tabindex 0 to the shown tab only', () => {
    const { dialog } = open();
    expect(tabs(dialog).map((element) => element.tabIndex)).toEqual([0, -1, -1, -1]);
    run(() => tab(dialog, 'Shortcuts').click());
    expect(tabs(dialog).map((element) => element.tabIndex)).toEqual([-1, 0, -1, -1]);
    run(() => tab(dialog, 'Processes').click());
    expect(tabs(dialog).map((element) => element.tabIndex)).toEqual([-1, -1, -1, 0]);
  });

  // plan-settings_dialog/REQ-11, REQ-54: Down/Up move to the next/previous menu item, wrapping; Home/End to the first/last
  it.each([
    ['ArrowDown', 'appearance', 'Shortcuts'],
    ['ArrowDown', 'shortcuts', 'Updates'],
    ['ArrowDown', 'updates', 'Processes'],
    ['ArrowDown', 'processes', 'Appearance'],
    ['ArrowUp', 'appearance', 'Processes'],
    ['ArrowUp', 'shortcuts', 'Appearance'],
    ['ArrowUp', 'processes', 'Updates'],
    ['Home', 'processes', 'Appearance'],
    ['End', 'appearance', 'Processes'],
  ] as const)('%s from the %s tab shows and focuses "%s"', (key, start, expected) => {
    const { dialog } = open(start);
    keydown(document.activeElement as Element, key);
    expect(tab(dialog, expected).getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab(dialog, expected));
    expect(visiblePanels(dialog).map((panel) => panel.getAttribute('aria-labelledby'))).toEqual([tab(dialog, expected).id]);
  });

  // plan-settings_dialog/REQ-7: Esc, "[Esc]" and "Close" call onClose
  it('Esc calls onClose', () => {
    const { onClose } = open();
    keydown(document.activeElement as Element, 'Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each(['Close', '[Esc]'])('the "%s" button calls onClose', (text) => {
    const { dialog, onClose } = open();
    run(() => buttonNamed(dialog, text).click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // spec SettingsDialog, Keyboard: Enter adds nothing (no primary action)
  it('Enter on a radio does not close the popup', () => {
    const { dialog, onClose } = open();
    const radio = radios(dialog).find((element) => element.checked) as HTMLInputElement;
    radio.focus();
    keydown(radio, 'Enter');
    expect(onClose).not.toHaveBeenCalled();
  });

  // plan-settings_dialog/REQ-11: Tab cycles "[Esc]", shown tab, checked radio, "Close", inside the dialog
  it('Tab from "Close" goes back to "[Esc]" and Shift+Tab from "[Esc]" goes to "Close"', () => {
    const { dialog } = open();
    const close = buttonNamed(dialog, 'Close');
    const esc = buttonNamed(dialog, '[Esc]');
    close.focus();
    const forward = keydown(close, 'Tab');
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(esc);
    const back = keydown(esc, 'Tab', { shiftKey: true });
    expect(back.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);
  });

  // plan-settings_dialog/REQ-15: a change in a section applies at once, the popup stays open
  it('choosing "Light" and then "Windows 11" changes both stores and keeps the popup open', () => {
    const { dialog, onClose, theme, look } = open();
    run(() => (radios(dialog).find((radio) => labelOf(radio) === 'Light') as HTMLInputElement).click());
    expect(theme.store.getSnapshot()).toBe('light');
    run(() => (radios(dialog).find((radio) => labelOf(radio) === 'Windows 11') as HTMLInputElement).click());
    expect(look.store.getSnapshot()).toBe('windows11');
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    run(() => tab(dialog, 'Shortcuts').click());
    run(() => tab(dialog, 'Appearance').click());
    expect(radios(dialog).filter((radio) => radio.checked).map(labelOf)).toEqual(['Light', 'Windows 11']);
  });

  // plan-settings_dialog/REQ-8: on close the focus goes back where it was before the popup opened
  it('gives the focus back to the element that had it before the popup opened', () => {
    const theme = themeStore('dark');
    const look = lookStore('vexel');
    function Host() {
      const [shown, setShown] = useState(false);
      return (
        <>
          <button type="button" id="opener" onClick={() => setShown(true)}>
            Settings
          </button>
          {shown && <SettingsDialog onClose={() => setShown(false)} themeStore={theme.store} lookStore={look.store} />}
        </>
      );
    }
    mount(<Host />);
    const opener = document.getElementById('opener') as HTMLButtonElement;
    opener.focus();
    run(() => opener.click());
    expect(document.activeElement).not.toBe(opener);
    keydown(document.activeElement as Element, 'Escape');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});

// The "Updates" tab: a fake fetch stands in for the installed version and the update check routes.
describe('SettingsDialog, "Updates" tab', () => {
  const NEWER = { status: 'newer', installedVersion: '0.6.1', newerVersion: '0.7.0', releaseUrl: 'https://github.com/owner/name/releases/tag/v0.7.0' };
  let release: ((body: unknown) => void) | undefined;
  let updateChecks: number;

  beforeEach(() => {
    updateChecks = 0;
    release = undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/installed-version') return Promise.resolve(new Response(JSON.stringify({ version: '0.6.1' }), { status: 200 }));
        updateChecks += 1;
        return new Promise<Response>((resolve) => (release = (body) => resolve(new Response(JSON.stringify(body), { status: 200 }))));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const shownPanel = (dialog: HTMLElement) => visiblePanels(dialog)[0] as HTMLElement;
  const until = (check: () => boolean) => vi.waitFor(() => expect(check()).toBe(true));
  const resultText = (dialog: HTMLElement) =>
    dialog.querySelector('[aria-label="Updates"] [role="status"], [aria-label="Updates"] [role="alert"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null;

  // plan-settings_dialog/REQ-43, REQ-44: initialTab "updates" opens the updates section only
  it('opens on the "Updates" tab when initialTab is "updates", with "Check for Updates" shown', async () => {
    const { dialog } = open('updates');
    const updates = tab(dialog, 'Updates');
    expect(updates.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(updates);
    expect(visiblePanels(dialog)).toHaveLength(1);
    expect(shownPanel(dialog).getAttribute('aria-labelledby')).toBe(updates.id);
    expect(buttonNamed(shownPanel(dialog), 'Check for Updates')).toBeDefined();
    await until(() => shownPanel(dialog).textContent?.includes('Installed version: v0.6.1') ?? false);
  });

  it('keeps the updates section out of sight behind another tab', () => {
    const { dialog } = open('appearance');
    expect(shownPanel(dialog).querySelector('[aria-label="Updates"]')).toBeNull();
    expect(buttonNamed(shownPanel(dialog), 'Check for Updates')).toBeUndefined();
  });

  // plan-settings_dialog/REQ-49, REQ-51: the newer version goes to the page, the popup stays open
  it('passes a newer result to onNewerVersion and stays open', async () => {
    const onClose = vi.fn();
    const onNewerVersion = vi.fn();
    const { dialog } = open('updates', onClose, onNewerVersion);
    run(() => buttonNamed(dialog, 'Check for Updates').click());
    await until(() => release !== undefined);
    run(() => release?.(NEWER));
    await until(() => onNewerVersion.mock.calls.length === 1);
    expect(onNewerVersion).toHaveBeenCalledWith({ installedVersion: '0.6.1', newerVersion: '0.7.0', releaseUrl: NEWER.releaseUrl });
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBe(dialog);
  });

  // plan-settings_dialog/REQ-51: whatever the result, the popup stays open
  it.each([{ status: 'current', installedVersion: '0.6.1' }, { status: 'failed' }])('stays open after the result %j', async (body) => {
    const { dialog, onClose } = open('updates');
    run(() => buttonNamed(dialog, 'Check for Updates').click());
    await until(() => release !== undefined);
    run(() => release?.(body));
    await until(() => resultText(dialog) !== null);
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBe(dialog);
  });

  // spec SettingsDialog: the result and a running check survive a tab change
  it('keeps a running check and its result across a tab change', async () => {
    const { dialog } = open('updates');
    run(() => buttonNamed(dialog, 'Check for Updates').click());
    await until(() => release !== undefined);
    run(() => tab(dialog, 'Appearance').click());
    run(() => release?.({ status: 'current', installedVersion: '0.6.1' }));
    run(() => tab(dialog, 'Updates').click());
    await until(() => resultText(dialog) !== null);
    expect(resultText(dialog)).toBe('You are up to date (v0.6.1)');
    run(() => tab(dialog, 'Shortcuts').click());
    run(() => tab(dialog, 'Updates').click());
    expect(resultText(dialog)).toBe('You are up to date (v0.6.1)');
    expect(updateChecks).toBe(1);
  });

  // spec SettingsDialog: a new opening starts with no result
  it('starts with no result when the popup opens again', async () => {
    const theme = themeStore('dark');
    const look = lookStore('vexel');
    const dialogOf = (shown: boolean) => (shown ? <SettingsDialog initialTab="updates" onClose={vi.fn()} themeStore={theme.store} lookStore={look.store} /> : null);
    mount(dialogOf(true));
    let dialog = document.querySelector<HTMLElement>('[role="dialog"]') as HTMLElement;
    run(() => buttonNamed(dialog, 'Check for Updates').click());
    await until(() => release !== undefined);
    run(() => release?.({ status: 'failed' }));
    await until(() => resultText(dialog) !== null);
    rerenderLast(dialogOf(false));
    rerenderLast(dialogOf(true));
    dialog = document.querySelector<HTMLElement>('[role="dialog"]') as HTMLElement;
    expect(resultText(dialog)).toBeNull();
    expect(buttonNamed(dialog, 'Check for Updates').disabled).toBe(false);
  });
});

// The "Processes" tab: a fake fetch stands in for GET /api/processes.
describe('SettingsDialog, "Processes" tab', () => {
  let processCalls: number;

  beforeEach(() => {
    processCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/processes') processCalls += 1;
        if (url === '/api/installed-version') return Promise.resolve(new Response(JSON.stringify({ version: '0.6.1' }), { status: 200 }));
        return Promise.resolve(new Response(JSON.stringify({ processes: [] }), { status: 200 }));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const shownPanel = (dialog: HTMLElement) => visiblePanels(dialog)[0] as HTMLElement;
  const until = (check: () => boolean) => vi.waitFor(() => expect(check()).toBe(true));

  // plan-app_processes/REQ-1, spec SettingsDialog: "Refresh" in the header and the "Process List" region as body
  it('opens on "Processes" when initialTab is "processes", with "Refresh" and the "Process List" region', async () => {
    const { dialog } = open('processes');
    const processes = tab(dialog, 'Processes');
    expect(processes.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(processes);
    expect(shownPanel(dialog).getAttribute('aria-labelledby')).toBe(processes.id);
    expect(buttonNamed(shownPanel(dialog), 'Refresh')).toBeDefined();
    expect(shownPanel(dialog).querySelector('[role="region"][aria-label="Process List"]')).not.toBeNull();
    await until(() => shownPanel(dialog).textContent?.includes('No app processes are running.') ?? false);
  });

  // spec SettingsDialog: ProcessesSection is mounted only while its menu shows
  it('does not load the process list while another menu shows', () => {
    open('appearance');
    expect(processCalls).toBe(0);
  });

  // plan-app_processes/REQ-10: each time the menu shows, the list loads again
  it('loads the list again each time the "Processes" menu shows', async () => {
    const { dialog } = open('processes');
    await until(() => processCalls === 1);
    run(() => tab(dialog, 'Appearance').click());
    run(() => tab(dialog, 'Processes').click());
    await until(() => processCalls === 2);
  });
});
