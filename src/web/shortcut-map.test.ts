// Tests of plan-keyboard_shortcuts, batches navigation, session-actions and shortcuts-panel: ShortcutMap spec.
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
// The keys this plan adds: the terminal keys come from earlier plans, unchanged (REQ-44).
const newKeys = allKeys.filter((key) => key.command.kind !== 'terminal');
const terminalKeys = allKeys.filter((key) => key.command.kind === 'terminal');
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

  // plan-keyboard_shortcuts/REQ-12, REQ-13, REQ-14, REQ-16, REQ-17, REQ-18, REQ-19, REQ-21: the six sessions rows and the theme row
  it('has the sessions and general rows of the key map, in order, with their keys and commands', () => {
    const rowsOf = (area: string) =>
      SHORTCUTS.filter((row) => row.area === area).map((row) => ({
        action: row.action,
        keys: row.keys.map((key) => ({ code: key.code, modifiers: [...key.modifiers].sort(), command: key.command })),
      }));
    expect(rowsOf('sessions')).toEqual([
      { action: 'New session dialog', keys: [{ code: 'KeyN', modifiers: ['Alt'], command: { kind: 'new-session' } }] },
      { action: 'Resume history dialog', keys: [{ code: 'KeyH', modifiers: ['Alt'], command: { kind: 'resume-history' } }] },
      { action: 'Rename the open session', keys: [{ code: 'KeyE', modifiers: ['Alt'], command: { kind: 'session-command', command: 'rename' } }] },
      {
        action: '"Resume" or "Resume Here" on the open session',
        keys: [{ code: 'KeyR', modifiers: ['Alt'], command: { kind: 'session-command', command: 'resume' } }],
      },
      { action: 'Stop the open hosted session', keys: [{ code: 'KeyQ', modifiers: ['Alt', 'Shift'], command: { kind: 'session-command', command: 'stop' } }] },
      { action: 'Dismiss the open ended session', keys: [{ code: 'KeyW', modifiers: ['Alt', 'Shift'], command: { kind: 'session-command', command: 'dismiss' } }] },
    ]);
    expect(rowsOf('general')).toEqual([
      { action: 'Light/Dark theme', keys: [{ code: 'KeyA', modifiers: ['Alt'], command: { kind: 'toggle-theme' } }] },
      { action: 'Shortcuts panel', keys: [{ code: 'KeyS', modifiers: ['Alt'], command: { kind: 'toggle-shortcuts-panel' } }] },
    ]);
  });

  // plan-keyboard_shortcuts/REQ-26, REQ-44: the existing terminal keys, keyed by typed character, with the terminal command
  it('has the terminal rows of the existing keys, in order', () => {
    const terminal = SHORTCUTS.filter((row) => row.area === 'terminal').map((row) => ({
      action: row.action,
      keys: row.keys.map((key) => ({ code: key.code, modifiers: [...key.modifiers].sort(), command: key.command })),
    }));
    const ctrl = (code: string) => ({ code, modifiers: ['Ctrl'], command: { kind: 'terminal' } });
    const ctrlShift = (code: string) => ({ code, modifiers: ['Ctrl', 'Shift'], command: { kind: 'terminal' } });
    expect(terminal).toEqual([
      { action: 'Search', keys: [ctrlShift('f')] },
      { action: 'Larger / smaller / default text', keys: [ctrl('='), ctrl('+'), ctrl('-'), ctrl('0')] },
      { action: 'Focus the list', keys: [ctrlShift('l')] },
    ]);
  });

  // ShortcutMap invariant: rows of the same area are next to each other, in the order navigation, sessions, terminal, general
  it('groups the rows by area, in the order navigation, sessions, terminal, general', () => {
    const areas = SHORTCUTS.map((row) => row.area).filter((area, index, all) => index === 0 || all[index - 1] !== area);
    expect(areas).toEqual(['navigation', 'sessions', 'terminal', 'general']);
  });

  // ShortcutMap invariant, assumption "Key map": the keys that stop or dismiss a session also need Shift
  it('gives Shift to the keys that stop or dismiss a session', () => {
    const removing = allKeys.filter((key) => key.command.kind === 'session-command' && (key.command.command === 'stop' || key.command.command === 'dismiss'));
    expect(removing).toHaveLength(2);
    for (const key of removing) expect(key.modifiers, comboOf(key)).toContain('Shift');
  });

  // plan-keyboard_shortcuts/REQ-34 and the ShortcutMap invariant: every key, new or terminal, has Ctrl or Alt, so none is a single character key
  it('gives every key Ctrl or Alt', () => {
    for (const key of allKeys) expect(key.modifiers.some((m) => m === 'Ctrl' || m === 'Alt'), comboOf(key)).toBe(true);
  });

  // plan-keyboard_shortcuts/REQ-35: no new key uses a letter of the key map exclusion list (Claude Code keys); the terminal keys are not new
  it('gives no new key the letters B, D, F, O, P, T, Y, M, V', () => {
    const excluded = ['KeyB', 'KeyD', 'KeyF', 'KeyO', 'KeyP', 'KeyT', 'KeyY', 'KeyM', 'KeyV'];
    for (const key of newKeys) expect(excluded, comboOf(key)).not.toContain(key.code);
  });

  // plan-keyboard_shortcuts/REQ-35: no new key is a Claude Code key of the spec "Constraints" (Ctrl with a letter, Ctrl+Enter, Ctrl+Shift+-)
  it('gives no new key a Claude Code terminal key', () => {
    const claudeCode = ['Ctrl+Enter', 'Ctrl+Shift+Minus', 'Escape', 'Tab', 'Shift+Tab'];
    for (const key of newKeys) {
      expect(claudeCode, comboOf(key)).not.toContain(comboOf(key));
      const ctrlLetterOnly = LETTER.test(key.code) && key.modifiers.includes('Ctrl') && !key.modifiers.includes('Alt');
      expect(ctrlLetterOnly, `${comboOf(key)} is Ctrl with a letter`).toBe(false);
    }
  });

  // plan-keyboard_shortcuts/REQ-36: no new key is a default Ubuntu GNOME key of the spec "Constraints"
  it('gives no new key a default Ubuntu GNOME key', () => {
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
    for (const key of newKeys) expect(gnome, comboOf(key)).not.toContain(comboOf(key));
  });

  // plan-keyboard_shortcuts/REQ-37: no new key is a key that Chromium keeps for itself
  it('gives no new key a key that the browser keeps', () => {
    const browser = ['Ctrl+KeyT', 'Ctrl+KeyW', 'Ctrl+KeyN', 'Ctrl+Shift+KeyT', 'Ctrl+Shift+KeyW', 'Ctrl+Shift+KeyN', 'Ctrl+Tab', 'Ctrl+Shift+Tab'];
    for (const key of newKeys) expect(browser, comboOf(key)).not.toContain(comboOf(key));
  });

  // plan-keyboard_shortcuts/REQ-34, REQ-45: every new key uses Alt, the left Alt of the key map, and never Ctrl, so none needs AltGr
  it('gives every new key Alt and no Ctrl', () => {
    for (const key of newKeys) {
      expect(key.modifiers, comboOf(key)).toContain('Alt');
      expect(key.modifiers, comboOf(key)).not.toContain('Ctrl');
    }
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

  // plan-keyboard_shortcuts/REQ-12, REQ-13, REQ-14, REQ-16, REQ-17, REQ-18, REQ-19, REQ-21: each session action key gives its command
  it.each([
    ['Alt+N', alt('KeyN'), { kind: 'new-session' }],
    ['Alt+H', alt('KeyH'), { kind: 'resume-history' }],
    ['Alt+E', alt('KeyE'), { kind: 'session-command', command: 'rename' }],
    ['Alt+R', alt('KeyR'), { kind: 'session-command', command: 'resume' }],
    ['Alt+Shift+Q', alt('KeyQ', { shift: true }), { kind: 'session-command', command: 'stop' }],
    ['Alt+Shift+W', alt('KeyW', { shift: true }), { kind: 'session-command', command: 'dismiss' }],
    ['Alt+A', alt('KeyA'), { kind: 'toggle-theme' }],
    ['Alt+S', alt('KeyS'), { kind: 'toggle-shortcuts-panel' }],
  ])('gives the command of %s', (_, event, command) => {
    expect(shortcutCommandOf(event)).toEqual(command);
  });

  // Assumption "Key map": stop and dismiss need Shift, so Alt alone on Q or W does nothing
  it('gives null for Alt+Q and Alt+W without Shift', () => {
    expect(shortcutCommandOf(alt('KeyQ'))).toBeNull();
    expect(shortcutCommandOf(alt('KeyW'))).toBeNull();
  });

  // ShortcutMap contract: an extra Shift on a session key is not that key
  it('gives null for Alt+Shift+R and Alt+Shift+E', () => {
    expect(shortcutCommandOf(alt('KeyR', { shift: true }))).toBeNull();
    expect(shortcutCommandOf(alt('KeyE', { shift: true }))).toBeNull();
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

  // plan-keyboard_shortcuts/REQ-26, REQ-28: every new key of the map gives its own command, so every row of the panel acts
  it('gives each new key of the map its own command', () => {
    for (const key of newKeys) {
      const event = keyEvent(key.code, { ctrl: key.modifiers.includes('Ctrl'), alt: key.modifiers.includes('Alt'), shift: key.modifiers.includes('Shift') });
      expect(shortcutCommandOf(event), comboOf(key)).toEqual(key.command);
    }
  });

  // ShortcutMap contract, plan-keyboard_shortcuts/REQ-44: a terminal key never gives a command, SessionView keeps it
  it.each([
    ['Ctrl+Shift+F', keyEvent('KeyF', { ctrl: true, shift: true, key: 'F' })],
    ['Ctrl+=', keyEvent('Equal', { ctrl: true, key: '=' })],
    ['Ctrl++', keyEvent('Equal', { ctrl: true, shift: true, key: '+' })],
    ['Ctrl+-', keyEvent('Minus', { ctrl: true, key: '-' })],
    ['Ctrl+0', keyEvent('Digit0', { ctrl: true, key: '0' })],
    ['Ctrl+Shift+L', keyEvent('KeyL', { ctrl: true, shift: true, key: 'L' })],
  ])('gives null for the terminal key %s', (_, event) => {
    expect(shortcutCommandOf(event)).toBeNull();
  });

  // ShortcutMap contract: a terminal key never gives a command, even with an event shaped as its own map entry
  it('gives null for every terminal key of the map', () => {
    expect(terminalKeys).not.toHaveLength(0);
    for (const key of terminalKeys) {
      const event = keyEvent(key.code, { ctrl: key.modifiers.includes('Ctrl'), alt: key.modifiers.includes('Alt'), shift: key.modifiers.includes('Shift'), key: key.code });
      expect(shortcutCommandOf(event), comboOf(key)).toBeNull();
    }
  });

  // plan-keyboard_shortcuts/REQ-45: Alt+S is the physical S key on any layout, and never with AltGr
  it('matches Alt+S by physical key and not with AltGr', () => {
    expect(shortcutCommandOf(alt('KeyS', { key: 'ß' }))).toEqual({ kind: 'toggle-shortcuts-panel' });
    expect(shortcutCommandOf(alt('KeyS', { altGraph: true }))).toBeNull();
    expect(shortcutCommandOf(alt('KeyS', { shift: true }))).toBeNull();
  });

  // ShortcutMap contract: the event type does not matter
  it('matches a keyup of a map key', () => {
    expect(shortcutCommandOf(alt('KeyI', { type: 'keyup' }))).toEqual({ kind: 'open-session', target: { kind: 'next-needs-input' } });
  });
});
