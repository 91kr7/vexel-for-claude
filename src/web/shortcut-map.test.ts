// Tests of plan-keyboard_shortcuts, batch navigation: ShortcutMap spec.
import { describe, expect, it } from 'vitest';
import { SHORTCUTS, type ShortcutKey, shortcutCommandOf } from './shortcut-map';

interface Pressed {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  altGraph?: boolean;
  key?: string;
  type?: string;
}

const keyEvent = (code: string, pressed: Pressed = {}): KeyboardEvent => {
  const state: Record<string, boolean> = {
    Control: pressed.ctrl ?? false,
    Alt: pressed.alt ?? false,
    Shift: pressed.shift ?? false,
    Meta: pressed.meta ?? false,
    AltGraph: pressed.altGraph ?? false,
  };
  return {
    type: pressed.type ?? 'keydown',
    code,
    key: pressed.key ?? code,
    ctrlKey: state.Control,
    altKey: state.Alt,
    shiftKey: state.Shift,
    metaKey: state.Meta,
    getModifierState: (name: string) => state[name] ?? false,
  } as unknown as KeyboardEvent;
};

const alt = (code: string, extra: Pressed = {}) => keyEvent(code, { alt: true, ...extra });

const allKeys: ShortcutKey[] = SHORTCUTS.flatMap((row) => [...row.keys]);
const comboOf = (key: ShortcutKey) => [...[...key.modifiers].sort(), key.code].join('+');
const LETTER = /^Key[A-Z]$/;

describe('SHORTCUTS', () => {
  // plan-keyboard_shortcuts/REQ-1, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7: the five navigation rows of the ShortcutMap table
  it('has the navigation rows of the key map, in order, with their keys and commands', () => {
    const navigation = SHORTCUTS.filter((row) => row.area === 'navigation').map((row) => ({
      action: row.action,
      keys: row.keys.map((key) => ({ code: key.code, modifiers: [...key.modifiers], command: key.command })),
    }));
    expect(navigation).toEqual([
      { action: 'Focus the list', keys: [{ code: 'KeyL', modifiers: ['Alt'], command: { kind: 'focus-list' } }] },
      { action: 'Focus the main view', keys: [{ code: 'KeyC', modifiers: ['Alt'], command: { kind: 'focus-main-view' } }] },
      {
        action: 'Previous / next session',
        keys: [
          { code: 'ArrowUp', modifiers: ['Alt'], command: { kind: 'open-session', target: { kind: 'previous' } } },
          { code: 'ArrowDown', modifiers: ['Alt'], command: { kind: 'open-session', target: { kind: 'next' } } },
        ],
      },
      {
        action: 'Session at position 1 to 9',
        keys: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((position) => ({
          code: `Digit${position}`,
          modifiers: ['Alt'],
          command: { kind: 'open-session', target: { kind: 'position', position } },
        })),
      },
      { action: 'Next session that needs input', keys: [{ code: 'KeyI', modifiers: ['Alt'], command: { kind: 'open-session', target: { kind: 'next-needs-input' } } }] },
    ]);
  });

  // plan-keyboard_shortcuts/REQ-34: every key has Ctrl or Alt, so none is a single character key
  it('gives every key Ctrl or Alt', () => {
    for (const key of allKeys) expect(key.modifiers.some((m) => m === 'Ctrl' || m === 'Alt'), comboOf(key)).toBe(true);
  });

  // plan-keyboard_shortcuts/REQ-35: no letter of the key map exclusion list (Claude Code keys)
  it('uses none of the letters B, D, F, O, P, T, Y, M, V', () => {
    const excluded = ['KeyB', 'KeyD', 'KeyF', 'KeyO', 'KeyP', 'KeyT', 'KeyY', 'KeyM', 'KeyV'];
    for (const key of allKeys) expect(excluded, comboOf(key)).not.toContain(key.code);
  });

  // plan-keyboard_shortcuts/REQ-35: no Claude Code key of the spec "Constraints" (Ctrl with a letter, Ctrl+Enter, Ctrl+Shift+-)
  it('uses no Claude Code terminal key', () => {
    const claudeCode = ['Ctrl+Enter', 'Ctrl+Shift+Minus', 'Escape', 'Tab', 'Shift+Tab'];
    for (const key of allKeys) {
      expect(claudeCode, comboOf(key)).not.toContain(comboOf(key));
      const ctrlLetterOnly = LETTER.test(key.code) && key.modifiers.includes('Ctrl') && !key.modifiers.includes('Alt');
      expect(ctrlLetterOnly, `${comboOf(key)} is Ctrl with a letter`).toBe(false);
    }
  });

  // plan-keyboard_shortcuts/REQ-36: no default Ubuntu GNOME key of the spec "Constraints"
  it('uses no default Ubuntu GNOME key', () => {
    const gnome = [
      'Alt+Tab',
      'Alt+F1',
      'Alt+F2',
      'Alt+F4',
      'Alt+Ctrl+ArrowUp',
      'Alt+Ctrl+ArrowDown',
      'Alt+Ctrl+ArrowLeft',
      'Alt+Ctrl+ArrowRight',
      'Alt+Ctrl+KeyT',
      'Alt+Ctrl+Delete',
    ];
    for (const key of allKeys) expect(gnome, comboOf(key)).not.toContain(comboOf(key));
  });

  // plan-keyboard_shortcuts/REQ-37: no key that Chromium keeps for itself
  it('uses no key that the browser keeps', () => {
    const browser = ['Ctrl+KeyT', 'Ctrl+KeyW', 'Ctrl+KeyN', 'Ctrl+Shift+KeyT', 'Ctrl+Shift+KeyW', 'Ctrl+Shift+KeyN', 'Ctrl+Tab', 'Ctrl+Shift+Tab'];
    for (const key of allKeys) expect(browser, comboOf(key)).not.toContain(comboOf(key));
  });

  // ShortcutMap invariant: no two keys with the same code and the same modifiers
  it('has no two keys with the same code and modifiers', () => {
    const combos = allKeys.map(comboOf);
    expect(new Set(combos).size).toBe(combos.length);
  });
});

describe('shortcutCommandOf', () => {
  // plan-keyboard_shortcuts/REQ-1, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7: each navigation key gives its command
  it.each([
    ['KeyL', { kind: 'focus-list' }],
    ['KeyC', { kind: 'focus-main-view' }],
    ['ArrowUp', { kind: 'open-session', target: { kind: 'previous' } }],
    ['ArrowDown', { kind: 'open-session', target: { kind: 'next' } }],
    ['Digit1', { kind: 'open-session', target: { kind: 'position', position: 1 } }],
    ['Digit5', { kind: 'open-session', target: { kind: 'position', position: 5 } }],
    ['Digit9', { kind: 'open-session', target: { kind: 'position', position: 9 } }],
    ['KeyI', { kind: 'open-session', target: { kind: 'next-needs-input' } }],
  ])('gives the command of Alt+%s', (code, command) => {
    expect(shortcutCommandOf(alt(code))).toEqual(command);
  });

  // plan-keyboard_shortcuts/REQ-45: the physical key decides, whatever character the layout types
  it('matches the physical key, not the typed character', () => {
    expect(shortcutCommandOf(alt('KeyL', { key: '¬' }))).toEqual({ kind: 'focus-list' });
    expect(shortcutCommandOf(alt('Digit1', { key: '&' }))).toEqual({ kind: 'open-session', target: { kind: 'position', position: 1 } });
    expect(shortcutCommandOf(alt('KeyK', { key: 'l' }))).toBeNull();
  });

  // ShortcutMap contract: Ctrl, Alt and Shift must be pressed exactly as the key lists them
  it.each([
    ['no modifier', keyEvent('KeyL')],
    ['Ctrl instead of Alt', keyEvent('KeyL', { ctrl: true })],
    ['an extra Shift', alt('KeyL', { shift: true })],
    ['an extra Ctrl', alt('KeyL', { ctrl: true })],
    ['an extra Ctrl on an arrow', alt('ArrowDown', { ctrl: true })],
  ])('gives null with %s', (_, event) => {
    expect(shortcutCommandOf(event)).toBeNull();
  });

  // ShortcutMap contract: Meta must not be pressed
  it('gives null with Meta pressed', () => {
    expect(shortcutCommandOf(alt('KeyL', { meta: true }))).toBeNull();
  });

  // plan-keyboard_shortcuts/REQ-45: a key typed with AltGr is never a shortcut
  it('gives null with AltGr pressed', () => {
    expect(shortcutCommandOf(alt('KeyL', { altGraph: true }))).toBeNull();
    expect(shortcutCommandOf(alt('Digit1', { altGraph: true }))).toBeNull();
  });

  // ShortcutMap contract: the code must equal the key's code, so a numpad digit is not a position key
  it('gives null for a key that is not in the map', () => {
    expect(shortcutCommandOf(alt('Numpad1'))).toBeNull();
    expect(shortcutCommandOf(alt('Digit0'))).toBeNull();
    expect(shortcutCommandOf(alt('KeyB'))).toBeNull();
  });

  // ShortcutMap contract: the event type does not matter
  it('matches a keyup of a map key', () => {
    expect(shortcutCommandOf(alt('KeyI', { type: 'keyup' }))).toEqual({ kind: 'open-session', target: { kind: 'next-needs-input' } });
  });
});
