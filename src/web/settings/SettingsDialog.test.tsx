// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsDialog, type SettingsTab } from './SettingsDialog';
import { keydown, labelOf, lookStore, mount, radios, run, themeStore, unmountAll } from './settings-test-support';

afterEach(unmountAll);

function open(initialTab?: SettingsTab, onClose = vi.fn()) {
  const theme = themeStore('dark');
  const look = lookStore('vexel');
  mount(<SettingsDialog initialTab={initialTab} onClose={onClose} themeStore={theme.store} lookStore={look.store} />);
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]') as HTMLElement;
  return { dialog, onClose, theme, look };
}

const tabs = (dialog: HTMLElement) => [...dialog.querySelectorAll<HTMLElement>('[role="tab"]')];
const tab = (dialog: HTMLElement, name: string) => tabs(dialog).find((element) => element.textContent === name) as HTMLElement;
const visiblePanels = (dialog: HTMLElement) => [...dialog.querySelectorAll<HTMLElement>('[role="tabpanel"]')].filter((panel) => !panel.hidden);
const shownLegend = (dialog: HTMLElement) => visiblePanels(dialog)[0]?.querySelector('legend')?.textContent;
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

  // plan-settings_dialog/REQ-6, REQ-21: a tab list "Settings sections" with "Theme", "Window Look", then "Shortcuts"
  it('has a tab list "Settings sections" with the tabs "Theme", "Window Look" and "Shortcuts", in this order', () => {
    const { dialog } = open();
    expect(dialog.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Settings sections');
    expect(tabs(dialog).map((element) => element.textContent)).toEqual(['Theme', 'Window Look', 'Shortcuts']);
  });

  // plan-settings_dialog/REQ-4: default tab "Theme", selected and focused on open; one panel shown, labelled by its tab
  it('opens on the "Theme" tab by default, with the focus on it and only the theme panel shown', () => {
    const { dialog } = open();
    const theme = tab(dialog, 'Theme');
    expect(theme.getAttribute('aria-selected')).toBe('true');
    expect(tab(dialog, 'Window Look').getAttribute('aria-selected')).toBe('false');
    expect(document.activeElement).toBe(theme);
    expect(visiblePanels(dialog)).toHaveLength(1);
    expect(visiblePanels(dialog)[0]?.getAttribute('aria-labelledby')).toBe(theme.id);
    expect(shownLegend(dialog)).toBe('Theme');
  });

  // spec SettingsDialog, Props: initialTab "look" opens on the "Window Look" tab
  it('opens on the "Window Look" tab when initialTab is "look"', () => {
    const { dialog } = open('look');
    expect(tab(dialog, 'Window Look').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab(dialog, 'Window Look'));
    expect(shownLegend(dialog)).toBe('Window Look');
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

  // spec SettingsDialog, Actions: a click on a tab shows its section
  it('a click on "Window Look" shows the look section, a click on "Theme" brings the theme section back', () => {
    const { dialog } = open();
    run(() => tab(dialog, 'Window Look').click());
    expect(tab(dialog, 'Window Look').getAttribute('aria-selected')).toBe('true');
    expect(shownLegend(dialog)).toBe('Window Look');
    run(() => tab(dialog, 'Theme').click());
    expect(shownLegend(dialog)).toBe('Theme');
  });

  // plan-settings_dialog/REQ-11: the tab list is one Tab stop, the shown tab
  it('gives tabindex 0 to the shown tab only', () => {
    const { dialog } = open();
    expect(tabs(dialog).map((element) => element.tabIndex)).toEqual([0, -1, -1]);
    run(() => tab(dialog, 'Window Look').click());
    expect(tabs(dialog).map((element) => element.tabIndex)).toEqual([-1, 0, -1]);
    run(() => tab(dialog, 'Shortcuts').click());
    expect(tabs(dialog).map((element) => element.tabIndex)).toEqual([-1, -1, 0]);
  });

  // plan-settings_dialog/REQ-11: arrows move to the next/previous tab, wrapping; Home/End to the first/last
  it.each([
    ['ArrowRight', 'theme', 'Window Look'],
    ['ArrowRight', 'look', 'Shortcuts'],
    ['ArrowRight', 'shortcuts', 'Theme'],
    ['ArrowLeft', 'theme', 'Shortcuts'],
    ['ArrowLeft', 'look', 'Theme'],
    ['ArrowLeft', 'shortcuts', 'Window Look'],
    ['Home', 'shortcuts', 'Theme'],
    ['End', 'theme', 'Shortcuts'],
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
    run(() => tab(dialog, 'Window Look').click());
    run(() => (radios(dialog).find((radio) => labelOf(radio) === 'Windows 11') as HTMLInputElement).click());
    expect(look.store.getSnapshot()).toBe('windows11');
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    run(() => tab(dialog, 'Theme').click());
    expect(radios(dialog).filter((radio) => radio.checked).map(labelOf)).toEqual(['Light']);
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
