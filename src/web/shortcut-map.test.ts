// Tests of plan-keyboard_shortcuts (batches navigation, session-actions, shortcuts-panel) and plan-settings_dialog (batch shortcuts-section): ShortcutMap spec.
import { describe, expect, it } from 'vitest';
import {
  SHORTCUTS,
  type ShortcutCommand,
  type ShortcutKey,
  activeKeys,
  commandKeysText,
  defaultKeys,
  hasDefaultKeys,
  keyMatches,
  keyText,
  keysText,
  pressOf,
  rowKeysText,
  shortcutCommandOf,
  shortcutRows,
  terminalShortcutOf,
} from './shortcut-map';
import { UserShortcutKeysStore } from './user-shortcut-keys';

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
  // plan-keyboard_shortcuts/REQ-1, REQ-3 to REQ-7, plan-settings_dialog/REQ-22, REQ-27: the navigation rows, one per action, with their ids, keys and commands
  it('has the navigation rows of the key map, one per action, in order, with their ids, keys and commands', () => {
    const navigation = SHORTCUTS.filter((row) => row.area === 'navigation').map((row) => ({
      id: row.id,
      action: row.action,
      keys: row.keys.map((key) => ({ code: key.code, modifiers: [...key.modifiers], command: key.command })),
    }));
    const one = (id: string, action: string, code: string, command: ShortcutCommand) => ({ id, action, keys: [{ code, modifiers: ['Alt'], command }] });
    expect(navigation).toEqual([
      one('focus-list', 'Focus the list', 'KeyL', { kind: 'focus-list' }),
      one('focus-main-view', 'Focus the main view', 'KeyC', { kind: 'focus-main-view' }),
      one('previous-session', 'Previous session', 'ArrowUp', { kind: 'open-session', target: { kind: 'previous' } }),
      one('next-session', 'Next session', 'ArrowDown', { kind: 'open-session', target: { kind: 'next' } }),
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((position) =>
        one(`session-at-${position}`, `Session at position ${position}`, `Digit${position}`, { kind: 'open-session', target: { kind: 'position', position } }),
      ),
      one('next-needs-input', 'Next session that needs input', 'KeyI', { kind: 'open-session', target: { kind: 'next-needs-input' } }),
    ]);
  });

  // plan-keyboard_shortcuts/REQ-12 to REQ-21, plan-settings_dialog/REQ-25: the six sessions rows, the theme row and the "Shortcut settings" row on Alt+S
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
      { action: 'Light/Dark/Dark Blue theme', keys: [{ code: 'KeyA', modifiers: ['Alt'], command: { kind: 'toggle-theme' } }] },
      { action: 'Shortcut settings', keys: [{ code: 'KeyS', modifiers: ['Alt'], command: { kind: 'open-shortcut-settings' } }] },
    ]);
  });

  // plan-keyboard_shortcuts/REQ-26, REQ-44, plan-settings_dialog/REQ-22, REQ-27: the existing terminal keys, one row per action, matched by typed character
  it('has the terminal rows of the existing keys, one per action, in order', () => {
    const terminal = SHORTCUTS.filter((row) => row.area === 'terminal').map((row) => ({
      id: row.id,
      action: row.action,
      keys: row.keys.map((key) => ({ code: key.code, modifiers: [...key.modifiers].sort(), command: key.command, byCharacter: key.byCharacter })),
    }));
    const ctrl = (code: string) => ({ code, modifiers: ['Ctrl'], command: { kind: 'terminal' }, byCharacter: true });
    const ctrlShift = (code: string) => ({ code, modifiers: ['Ctrl', 'Shift'], command: { kind: 'terminal' }, byCharacter: true });
    expect(terminal).toEqual([
      { id: 'terminal-search', action: 'Search', keys: [ctrlShift('f')] },
      { id: 'terminal-larger-text', action: 'Larger text', keys: [ctrl('='), ctrl('+')] },
      { id: 'terminal-smaller-text', action: 'Smaller text', keys: [ctrl('-')] },
      { id: 'terminal-default-text', action: 'Default text size', keys: [ctrl('0')] },
      { id: 'terminal-focus-list', action: 'Focus the list', keys: [ctrlShift('l')] },
    ]);
  });

  // ShortcutMap contract: the ids of the sessions and general rows, and no two rows with the same id
  it('gives the sessions and general rows their ids, and every row a distinct id', () => {
    expect(SHORTCUTS.filter((row) => row.area === 'sessions' || row.area === 'general').map((row) => row.id)).toEqual([
      'new-session',
      'resume-history',
      'rename-session',
      'resume-session',
      'stop-session',
      'dismiss-session',
      'toggle-theme',
      'shortcut-settings',
    ]);
    expect(new Set(SHORTCUTS.map((row) => row.id)).size).toBe(SHORTCUTS.length);
  });

  // plan-settings_dialog/REQ-39: Enter and Esc of the dialogs are not rows
  it('has no row for Enter or Esc', () => {
    for (const key of allKeys) expect(['Enter', 'Escape', 'NumpadEnter'], comboOf(key)).not.toContain(key.code);
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
    ['Alt+S', alt('KeyS'), { kind: 'open-shortcut-settings' }],
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
    expect(shortcutCommandOf(alt('KeyS', { key: 'ß' }))).toEqual({ kind: 'open-shortcut-settings' });
    expect(shortcutCommandOf(alt('KeyS', { altGraph: true }))).toBeNull();
    expect(shortcutCommandOf(alt('KeyS', { shift: true }))).toBeNull();
  });

  // ShortcutMap contract: the event type does not matter
  it('matches a keyup of a map key', () => {
    expect(shortcutCommandOf(alt('KeyI', { type: 'keyup' }))).toEqual({ kind: 'open-session', target: { kind: 'next-needs-input' } });
  });
});

describe('keyText', () => {
  const key = (code: string): ShortcutKey => ({ code, modifiers: ['Alt'], command: { kind: 'focus-list' } });
  const terminal = (code: string): ShortcutKey => ({ code, modifiers: ['Ctrl'], command: { kind: 'terminal' }, byCharacter: true });

  // ShortcutMap contract, keyText table: a letter key shows its letter, without modifiers
  it.each([
    ['KeyA', 'A'],
    ['KeyS', 'S'],
    ['KeyZ', 'Z'],
  ])('gives %s as "%s"', (code, text) => {
    expect(keyText(key(code))).toBe(text);
  });

  // ShortcutMap contract, keyText table: a digit key shows its digit
  it.each([
    ['Digit0', '0'],
    ['Digit1', '1'],
    ['Digit9', '9'],
  ])('gives %s as "%s"', (code, text) => {
    expect(keyText(key(code))).toBe(text);
  });

  // ShortcutMap contract, keyText table: the arrows show "Up" and "Down"
  it('gives ArrowUp as "Up" and ArrowDown as "Down"', () => {
    expect(keyText(key('ArrowUp'))).toBe('Up');
    expect(keyText(key('ArrowDown'))).toBe('Down');
  });

  // ShortcutMap contract, keyText table: a terminal key shows its character in upper case
  it.each([
    ['f', 'F'],
    ['l', 'L'],
    ['=', '='],
    ['+', '+'],
    ['-', '-'],
    ['0', '0'],
  ])('gives the terminal key %s as "%s"', (code, text) => {
    expect(keyText(terminal(code))).toBe(text);
  });
});

describe('keyText of any key a user can choose', () => {
  const key = (code: string): ShortcutKey => ({ code, modifiers: ['Alt'], command: { kind: 'focus-list' } });

  // plan-settings_dialog/REQ-23, REQ-26, ShortcutMap keyText table: every physical key a user can choose has a readable text
  it.each([
    ['F1', 'F1'],
    ['F12', 'F12'],
    ['F24', 'F24'],
    ['Enter', 'Enter'],
    ['Space', 'Space'],
    ['Tab', 'Tab'],
    ['Home', 'Home'],
    ['End', 'End'],
    ['Backspace', 'Backspace'],
    ['ArrowLeft', 'Left'],
    ['ArrowRight', 'Right'],
    ['Escape', 'Esc'],
    ['Delete', 'Del'],
    ['Insert', 'Ins'],
    ['PageUp', 'Page Up'],
    ['PageDown', 'Page Down'],
    ['NumpadEnter', 'Enter'],
    ['Minus', '-'],
    ['Equal', '='],
    ['BracketLeft', '['],
    ['BracketRight', ']'],
    ['Backslash', '\\'],
    ['IntlBackslash', '<'],
    ['Semicolon', ';'],
    ['Quote', "'"],
    ['Backquote', '`'],
    ['Comma', ','],
    ['Period', '.'],
    ['Slash', '/'],
    ['Numpad0', 'Num 0'],
    ['Numpad7', 'Num 7'],
    ['MediaPlayPause', 'MediaPlayPause'],
  ])('gives %s as "%s"', (code, text) => {
    expect(keyText(key(code))).toBe(text);
  });

  // plan-settings_dialog/REQ-38, ShortcutMap contract: keysText joins the modifiers and the key text with "+"
  it('gives the modifiers, then the key text, joined by "+"', () => {
    expect(keysText({ code: 'KeyS', modifiers: ['Alt'] })).toBe('Alt+S');
    expect(keysText({ code: 'KeyQ', modifiers: ['Alt', 'Shift'] })).toBe('Alt+Shift+Q');
    expect(keysText({ code: 'f', modifiers: ['Ctrl', 'Shift'], byCharacter: true })).toBe('Ctrl+Shift+F');
    expect(keysText({ code: 'Slash', modifiers: ['Ctrl', 'Alt'] })).toBe('Ctrl+Alt+/');
  });
});

describe('active keys', () => {
  const altK = { code: 'KeyK', modifiers: ['Alt'] as const, character: 'k' };

  // ShortcutMap contract: a row without a user key has its default keys
  it('gives the default keys of a row with no user key', () => {
    const store = new UserShortcutKeysStore();
    expect(activeKeys('terminal-larger-text', store)).toEqual(defaultKeys('terminal-larger-text'));
    expect(defaultKeys('terminal-larger-text').map((key) => key.code)).toEqual(['=', '+']);
    expect(shortcutRows(store)).toEqual(SHORTCUTS);
  });

  // plan-settings_dialog/REQ-26, ShortcutMap contract: a user key replaces every default key of the row, keeps the row command, and matches by physical key
  it('gives the one user key of a row, with the row command, by physical key', () => {
    const store = new UserShortcutKeysStore();
    store.set('terminal-larger-text', altK);
    store.set('focus-list', { code: 'KeyJ', modifiers: ['Alt', 'Shift'] });
    const larger = activeKeys('terminal-larger-text', store);
    expect(larger).toHaveLength(1);
    expect(larger[0]).toMatchObject({ code: 'KeyK', modifiers: ['Alt'], command: { kind: 'terminal' }, character: 'k' });
    expect(larger[0]?.byCharacter ?? false).toBe(false);
    expect(activeKeys('focus-list', store)).toEqual([expect.objectContaining({ code: 'KeyJ', modifiers: ['Alt', 'Shift'], command: { kind: 'focus-list' } })]);
    const rows = shortcutRows(store);
    expect(rows.map((row) => row.id)).toEqual(SHORTCUTS.map((row) => row.id));
    expect(rows.find((row) => row.id === 'focus-list')?.keys).toEqual(activeKeys('focus-list', store));
    expect(defaultKeys('focus-list')).toEqual(SHORTCUTS.find((row) => row.id === 'focus-list')?.keys);
  });

  // plan-settings_dialog/REQ-34, ShortcutMap contract: hasDefaultKeys compares the shown texts with the defaults
  it('tells whether a row shows its default keys', () => {
    const store = new UserShortcutKeysStore();
    expect(hasDefaultKeys('focus-list', store)).toBe(true);
    store.set('focus-list', altK);
    expect(hasDefaultKeys('focus-list', store)).toBe(false);
    store.set('focus-list', { code: 'KeyL', modifiers: ['Alt'] });
    expect(hasDefaultKeys('focus-list', store), 'Alt+L chosen again is the default text').toBe(true);
    store.set('terminal-larger-text', { code: 'Equal', modifiers: ['Ctrl'], character: '=' });
    expect(hasDefaultKeys('terminal-larger-text', store), 'one key of two is not the defaults').toBe(false);
    store.restoreAll();
    expect(hasDefaultKeys('terminal-larger-text', store)).toBe(true);
  });

  // plan-settings_dialog/REQ-38: the tooltip text of a row lists its active keys joined by " / "
  it('gives the tooltip text of the active keys of a row', () => {
    const store = new UserShortcutKeysStore();
    expect(rowKeysText('terminal-search', store)).toBe('Ctrl+Shift+F');
    expect(rowKeysText('terminal-larger-text', store)).toBe('Ctrl+= / Ctrl++');
    expect(rowKeysText('terminal-smaller-text', store)).toBe('Ctrl+-');
    expect(rowKeysText('terminal-default-text', store)).toBe('Ctrl+0');
    expect(rowKeysText('shortcut-settings', store)).toBe('Alt+S');
    store.set('terminal-search', altK);
    store.set('terminal-larger-text', { code: 'Digit9', modifiers: ['Ctrl', 'Alt'], character: '9' });
    expect(rowKeysText('terminal-search', store)).toBe('Alt+K');
    expect(rowKeysText('terminal-larger-text', store)).toBe('Ctrl+Alt+9');
  });

  // plan-settings_dialog/REQ-37, REQ-38: commandKeysText follows the active keys
  it('gives the texts of the active keys of a command', () => {
    const store = new UserShortcutKeysStore();
    store.set('shortcut-settings', { code: 'F2', modifiers: ['Ctrl'] });
    expect(commandKeysText('open-shortcut-settings', store)).toEqual(['Ctrl+F2']);
  });

  // plan-settings_dialog/REQ-37: a user key runs the command at once, and the default key it replaced runs nothing
  it('runs the command of a user key and not of the replaced default key', () => {
    const store = new UserShortcutKeysStore();
    store.set('new-session', altK);
    expect(shortcutCommandOf(alt('KeyK', { key: 'k' }), store)).toEqual({ kind: 'new-session' });
    expect(shortcutCommandOf(alt('KeyN', { key: 'n' }), store)).toBeNull();
    expect(shortcutCommandOf(alt('KeyK', { key: 'k', shift: true }), store), 'Shift must match exactly').toBeNull();
    expect(shortcutCommandOf(alt('KeyK', { key: 'k', altGraph: true }), store), 'never with AltGr').toBeNull();
    expect(shortcutCommandOf(alt('KeyK', { key: 'k', meta: true }), store), 'never with Meta').toBeNull();
  });

  // plan-settings_dialog/REQ-27, ShortcutMap contract: a user key of a terminal row gives no command, only its terminal id
  it('gives a terminal user key no command and its terminal row id', () => {
    const store = new UserShortcutKeysStore();
    store.set('terminal-search', altK);
    expect(shortcutCommandOf(alt('KeyK', { key: 'k' }), store)).toBeNull();
    expect(terminalShortcutOf(alt('KeyK', { key: 'k' }), store)).toBe('terminal-search');
    expect(terminalShortcutOf(alt('KeyK', { key: 'l' }), store), 'a user key matches by physical key').toBe('terminal-search');
    expect(terminalShortcutOf(keyEvent('KeyF', { ctrl: true, shift: true, key: 'F' }), store), 'the replaced default runs nothing').toBeNull();
  });
});

describe('terminalShortcutOf with the default keys', () => {
  const store = new UserShortcutKeysStore();

  // plan-keyboard_shortcuts/REQ-44, ShortcutMap contract: the default terminal keys match by the typed character
  it.each([
    ['Ctrl+Shift+F', keyEvent('KeyF', { ctrl: true, shift: true, key: 'F' }), 'terminal-search'],
    ['Ctrl+Shift+F, lower case', keyEvent('KeyF', { ctrl: true, shift: true, key: 'f' }), 'terminal-search'],
    ['Ctrl+=', keyEvent('Equal', { ctrl: true, key: '=' }), 'terminal-larger-text'],
    ['Ctrl++', keyEvent('Equal', { ctrl: true, shift: true, key: '+' }), 'terminal-larger-text'],
    ['Ctrl+Shift+0 typing "=" (Italian layout)', keyEvent('Digit0', { ctrl: true, shift: true, key: '=' }), 'terminal-larger-text'],
    ['Ctrl+-', keyEvent('Minus', { ctrl: true, key: '-' }), 'terminal-smaller-text'],
    ['Ctrl+0', keyEvent('Digit0', { ctrl: true, key: '0' }), 'terminal-default-text'],
    ['Ctrl+Shift+L', keyEvent('KeyL', { ctrl: true, shift: true, key: 'L' }), 'terminal-focus-list'],
  ])('gives the row of %s', (_, event, id) => {
    expect(terminalShortcutOf(event, store)).toBe(id);
  });

  // ShortcutMap contract: a default terminal key needs Ctrl, no Alt and no Meta, and Shift when it lists Shift
  it.each([
    ['Ctrl+F without Shift', keyEvent('KeyF', { ctrl: true, key: 'f' })],
    ['Ctrl+Alt+=', keyEvent('Equal', { ctrl: true, alt: true, key: '=' })],
    ['Ctrl+Meta+-', keyEvent('Minus', { ctrl: true, meta: true, key: '-' })],
    ['= without Ctrl', keyEvent('Equal', { key: '=' })],
    ['Ctrl+Shift+- typing "_"', keyEvent('Minus', { ctrl: true, shift: true, key: '_' })],
    ['Alt+L, a client key', alt('KeyL', { key: 'l' })],
  ])('gives null for %s', (_, event) => {
    expect(terminalShortcutOf(event, store)).toBeNull();
  });

  // ShortcutMap contract: pressOf reads code, key, the modifiers and AltGr; keyMatches applies the physical match
  it('reads a press and matches a physical key exactly', () => {
    const press = pressOf(alt('KeyL', { key: 'l' }));
    expect(press).toMatchObject({ code: 'KeyL', key: 'l', ctrlKey: false, altKey: true, shiftKey: false, metaKey: false, altGraph: false });
    const focusList = defaultKeys('focus-list')[0]!;
    expect(keyMatches(focusList, press)).toBe(true);
    expect(keyMatches(focusList, pressOf(alt('KeyL', { altGraph: true })))).toBe(false);
    expect(keyMatches(focusList, pressOf(alt('KeyL', { ctrl: true })))).toBe(false);
  });
});

describe('commandKeysText', () => {
  // plan-settings_dialog/REQ-3, ShortcutMap contract: the settings command has the one key Alt+S
  it('gives ["Alt+S"] for open-shortcut-settings', () => {
    expect(commandKeysText('open-shortcut-settings')).toEqual(['Alt+S']);
  });

  // ShortcutMap contract: the modifiers, then the key text, joined by "+", one text per key in map order
  it('gives one text per key of a command, in map order, with every modifier', () => {
    expect(commandKeysText('toggle-theme')).toEqual(['Alt+A']);
    expect(commandKeysText('open-session')).toEqual(['Alt+Up', 'Alt+Down', ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => `Alt+${digit}`), 'Alt+I']);
    expect(commandKeysText('session-command')).toEqual(['Alt+E', 'Alt+R', 'Alt+Shift+Q', 'Alt+Shift+W']);
  });

  // ShortcutMap contract: a kind with no key in the map gives no text
  it('gives [] for a kind with no key', () => {
    expect(commandKeysText('no-such-command' as ShortcutCommand['kind'])).toEqual([]);
  });
});
