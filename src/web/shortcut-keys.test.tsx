// @vitest-environment jsdom
// Tests of plan-keyboard_shortcuts, batch shortcuts-panel, and plan-settings_dialog, batch shortcuts-section: useShortcutKeys spec and the dialog rule.
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShortcutCommand } from './shortcut-map';
import { useShortcutKeys } from './shortcut-keys';

function Listener({ run }: { run: (command: ShortcutCommand) => void }) {
  useShortcutKeys(run);
  return null;
}

let root: Root | undefined;
let field: HTMLInputElement;
let reached: Mock<(event: Event) => void>;
let run: Mock<(command: ShortcutCommand) => void>;

// The shell may export NODE_ENV=production, where React has no `act`: flushSync commits the render and its effects at once.
beforeEach(() => {
  field = document.createElement('input');
  document.body.append(field);
  reached = vi.fn<(event: Event) => void>();
  field.addEventListener('keydown', reached);
  run = vi.fn<(command: ShortcutCommand) => void>();
  root = createRoot(document.createElement('div'));
  flushSync(() => root?.render(<Listener run={run} />));
});

afterEach(() => {
  root?.unmount();
  root = undefined;
  document.body.replaceChildren();
});

function openDialog(className?: string): HTMLElement {
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  if (className !== undefined) dialog.className = `modal ${className}`;
  document.body.append(dialog);
  return dialog;
}

interface Keys {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  key?: string;
}

/** Dispatches a keydown on the text field and tells whether it was cancelled. */
function press(code: string, keys: Keys = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    code,
    key: keys.key ?? code,
    ctrlKey: keys.ctrl ?? false,
    altKey: keys.alt ?? false,
    shiftKey: keys.shift ?? false,
    bubbles: true,
    cancelable: true,
  });
  field.dispatchEvent(event);
  return event;
}

const altS = () => press('KeyS', { alt: true, key: 's' });

describe('useShortcutKeys', () => {
  // plan-settings_dialog/REQ-25, plan-keyboard_shortcuts/REQ-40, REQ-41: with no dialog, Alt+S runs, is cancelled and stopped, also inside a text field
  it('runs Alt+S with no dialog open, cancels it and keeps it from the focused element', () => {
    const event = altS();
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith({ kind: 'open-shortcut-settings' });
    expect(event.defaultPrevented).toBe(true);
    expect(reached).not.toHaveBeenCalled();
  });

  // plan-keyboard_shortcuts/REQ-42, useShortcutKeys contract: while a dialog is open, every map key does nothing and passes untouched
  it.each([
    ['Alt+S', 'KeyS', { alt: true, key: 's' }],
    ['Alt+N', 'KeyN', { alt: true }],
    ['Alt+A', 'KeyA', { alt: true }],
    ['Alt+Down', 'ArrowDown', { alt: true }],
    ['Alt+Shift+Q', 'KeyQ', { alt: true, shift: true }],
  ] as const)('blocks %s while a dialog is open', (_, code, keys) => {
    openDialog();
    const event = press(code, keys);
    expect(run).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(reached).toHaveBeenCalledTimes(1);
  });

  // plan-settings_dialog/REQ-24, useShortcutKeys contract: no exception, a dialog with the old shortcuts-panel class blocks Alt+S too
  it('blocks Alt+S while a dialog with the class shortcuts-panel is open', () => {
    openDialog('shortcuts-panel');
    const event = altS();
    expect(run).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(reached).toHaveBeenCalledTimes(1);
  });

  // plan-settings_dialog/REQ-25, SettingsDialog invariant: Alt+S does nothing while the settings popup is open
  it('blocks Alt+S while the settings popup is open', () => {
    openDialog('settings-dialog');
    const event = altS();
    expect(run).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(reached).toHaveBeenCalledTimes(1);
  });

  // plan-keyboard_shortcuts/REQ-44, ShortcutMap contract: the handler never runs a terminal key, it passes untouched to SessionView
  it.each([
    ['Ctrl+Shift+F', 'KeyF', { ctrl: true, shift: true, key: 'F' }],
    ['Ctrl+=', 'Equal', { ctrl: true, key: '=' }],
    ['Ctrl+0', 'Digit0', { ctrl: true, key: '0' }],
    ['Ctrl+Shift+L', 'KeyL', { ctrl: true, shift: true, key: 'L' }],
  ] as const)('lets the terminal key %s pass untouched', (_, code, keys) => {
    const event = press(code, keys);
    expect(run).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(reached).toHaveBeenCalledTimes(1);
  });

  // plan-keyboard_shortcuts/REQ-41: the editing keys of a text field pass untouched
  it.each([
    ['Ctrl+A', 'KeyA', { ctrl: true, key: 'a' }],
    ['S', 'KeyS', { key: 's' }],
    ['Shift+S', 'KeyS', { shift: true, key: 'S' }],
  ] as const)('lets the editing key %s pass untouched', (_, code, keys) => {
    const event = press(code, keys);
    expect(run).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(reached).toHaveBeenCalledTimes(1);
  });

  // useShortcutKeys contract: unmount removes the listener
  it('does nothing after unmount', () => {
    root?.unmount();
    root = undefined;
    const event = altS();
    expect(run).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
