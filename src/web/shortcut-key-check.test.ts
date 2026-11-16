// Tests of plan-settings_dialog, batch editable-shortcuts: ShortcutKeyCheck spec.
import { describe, expect, it } from 'vitest';
import { checkDefaultKeys, checkPress, modifiersOfPress } from './shortcut-key-check';
import type { KeyPress } from './shortcut-map';
import { UserShortcutKeysStore } from './user-shortcut-keys';

interface Extra {
  key?: string;
  altGraph?: boolean;
}

/** The character a US layout types for a code, without Shift. */
const characterOf = (code: string) => code.replace(/^Key([A-Z])$/, (_, letter: string) => letter.toLowerCase()).replace(/^Digit(\d)$/, '$1');

/** A press written as "Ctrl+Shift+KeyF": the modifiers, then the physical key. */
const press = (combo: string, extra: Extra = {}): KeyPress => {
  const parts = combo.split('+');
  const code = parts.pop()!;
  return {
    code,
    key: extra.key ?? characterOf(code),
    ctrlKey: parts.includes('Ctrl'),
    altKey: parts.includes('Alt'),
    shiftKey: parts.includes('Shift'),
    metaKey: parts.includes('Meta'),
    altGraph: extra.altGraph ?? false,
  };
};

const rejected = (message: string) => ({ accepted: false, message });
const ACCEPTED = { accepted: true };

describe('checkPress', () => {
  // plan-settings_dialog/REQ-28, REQ-31: no Ctrl and no Alt → rejected with its reason
  it.each(['KeyK', 'Shift+KeyK', 'F5', 'Shift+Digit1', 'Enter', 'Escape', 'Meta+KeyK', 'Shift+Meta+KeyK'])('rejects %s with "Use Ctrl or Alt in the shortcut"', (combo) => {
    expect(checkPress('new-session', press(combo), new UserShortcutKeysStore())).toEqual(rejected('Use Ctrl or Alt in the shortcut'));
  });

  // ShortcutKeyCheck rule 1: a press with AltGr is rejected, even with Ctrl and Alt
  it('rejects a press with AltGr with "Use Ctrl or Alt in the shortcut"', () => {
    const store = new UserShortcutKeysStore();
    expect(checkPress('new-session', press('Ctrl+Alt+KeyQ', { key: '@', altGraph: true }), store)).toEqual(rejected('Use Ctrl or Alt in the shortcut'));
    expect(checkPress('new-session', press('Alt+KeyK', { altGraph: true }), store)).toEqual(rejected('Use Ctrl or Alt in the shortcut'));
  });

  // plan-settings_dialog/REQ-29, REQ-31: a reserved key is rejected with its owner
  it.each([
    ['Alt+KeyB', 'Used by Claude Code'],
    ['Ctrl+KeyK', 'Used by Claude Code'],
    ['Ctrl+Enter', 'Used by Claude Code'],
    ['Ctrl+KeyT', 'Used by Claude Code'],
    ['Alt+Tab', 'Used by the desktop'],
    ['Ctrl+Alt+ArrowLeft', 'Used by the desktop'],
    ['Alt+Meta+KeyK', 'Used by the desktop'],
    ['Ctrl+Meta+KeyK', 'Used by the desktop'],
    ['Ctrl+Shift+KeyT', 'Used by the browser'],
    ['Ctrl+PageDown', 'Used by the browser'],
  ])('rejects %s with "%s"', (combo, message) => {
    expect(checkPress('new-session', press(combo), new UserShortcutKeysStore())).toEqual(rejected(message));
  });

  // plan-settings_dialog/REQ-30, REQ-32: a key of another row is rejected with the action of that row
  it.each([
    ['Alt+KeyL', 'new-session', 'Already used by Focus the list'],
    ['Alt+ArrowUp', 'new-session', 'Already used by Previous session'],
    ['Alt+Digit3', 'new-session', 'Already used by Session at position 3'],
    ['Alt+Shift+KeyQ', 'new-session', 'Already used by Stop the open hosted session'],
    ['Alt+KeyS', 'new-session', 'Already used by Shortcut settings'],
    ['Alt+KeyN', 'shortcut-settings', 'Already used by New session dialog'],
  ] as const)('rejects %s for %s with "%s"', (combo, id, message) => {
    expect(checkPress(id, press(combo), new UserShortcutKeysStore())).toEqual(rejected(message));
  });

  // ShortcutKeyCheck contract: a default terminal key conflicts when the terminal would run it for the same press
  it.each([
    ['Ctrl+Shift+KeyF', 'F', 'Already used by Search'],
    ['Ctrl+Equal', '=', 'Already used by Larger text'],
    ['Ctrl+Shift+Equal', '+', 'Already used by Larger text'],
    ['Ctrl+Shift+Digit0', '=', 'Already used by Larger text'],
    ['Ctrl+Minus', '-', 'Already used by Smaller text'],
    ['Ctrl+Digit0', '0', 'Already used by Default text size'],
    ['Ctrl+Shift+KeyL', 'L', 'Already used by Focus the list'],
  ])('rejects %s typing "%s" with "%s"', (combo, key, message) => {
    expect(checkPress('new-session', press(combo, { key }), new UserShortcutKeysStore())).toEqual(rejected(message));
  });

  // ShortcutKeyCheck order: rule 1 before rule 2 before rule 3
  it('gives the first failing rule in the order: no Ctrl or Alt, reserved, used by another row', () => {
    const store = new UserShortcutKeysStore();
    store.set('focus-list', { code: 'KeyB', modifiers: ['Alt'] });
    expect(checkPress('new-session', press('Alt+KeyB'), store)).toEqual(rejected('Used by Claude Code'));
    store.set('resume-history', { code: 'KeyK', modifiers: ['Shift'] });
    expect(checkPress('new-session', press('Shift+KeyK'), store)).toEqual(rejected('Use Ctrl or Alt in the shortcut'));
  });

  // plan-settings_dialog/REQ-26, REQ-30: a free combination is accepted
  it.each(['Alt+KeyK', 'Alt+Shift+KeyK', 'Ctrl+Alt+KeyK', 'Alt+F5', 'Ctrl+F5', 'Alt+Digit0', 'Ctrl+Shift+KeyK'])('accepts %s for "New session dialog"', (combo) => {
    expect(checkPress('new-session', press(combo), new UserShortcutKeysStore())).toEqual(ACCEPTED);
  });

  // ShortcutKeyCheck contract: the row's own keys never conflict
  it('accepts the own keys of the row', () => {
    const store = new UserShortcutKeysStore();
    expect(checkPress('focus-list', press('Alt+KeyL'), store)).toEqual(ACCEPTED);
    expect(checkPress('terminal-larger-text', press('Ctrl+Shift+Equal', { key: '+' }), store)).toEqual(ACCEPTED);
    store.set('resume-history', { code: 'KeyJ', modifiers: ['Alt'] });
    expect(checkPress('resume-history', press('Alt+KeyJ'), store)).toEqual(ACCEPTED);
  });

  // plan-settings_dialog/REQ-30, REQ-37: the active keys count, so a user key takes its combination and frees the default one
  it('checks against the active keys: a user key conflicts, the default key it replaced is free', () => {
    const store = new UserShortcutKeysStore();
    store.set('focus-list', { code: 'KeyK', modifiers: ['Alt'] });
    expect(checkPress('new-session', press('Alt+KeyK'), store)).toEqual(rejected('Already used by Focus the list'));
    expect(checkPress('new-session', press('Alt+KeyL'), store)).toEqual(ACCEPTED);
  });

  // plan-settings_dialog/REQ-27, REQ-30: a user key of a terminal row conflicts like any other key
  it('rejects the user key of a terminal row with the action of that row', () => {
    const store = new UserShortcutKeysStore();
    store.set('terminal-search', { code: 'KeyK', modifiers: ['Alt'], character: 'k' });
    expect(checkPress('new-session', press('Alt+KeyK', { key: 'k' }), store)).toEqual(rejected('Already used by Search'));
    expect(checkPress('new-session', press('Ctrl+Shift+KeyF', { key: 'F' }), store)).toEqual(ACCEPTED);
  });

  // ShortcutKeyCheck contract: a conflict names the first row in map order
  it('names the first row in map order when two rows conflict', () => {
    const store = new UserShortcutKeysStore();
    store.set('shortcut-settings', { code: 'KeyK', modifiers: ['Alt'] });
    store.set('resume-history', { code: 'KeyK', modifiers: ['Alt'] });
    expect(checkPress('new-session', press('Alt+KeyK'), store)).toEqual(rejected('Already used by Resume history dialog'));
  });

  // ShortcutKeyCheck contract: the check changes nothing
  it('changes no key', () => {
    const store = new UserShortcutKeysStore();
    store.set('focus-list', { code: 'KeyK', modifiers: ['Alt'] });
    const before = store.getSnapshot();
    checkPress('new-session', press('Alt+KeyJ'), store);
    checkPress('new-session', press('Alt+KeyK'), store);
    checkDefaultKeys('focus-list', store);
    expect(store.getSnapshot()).toBe(before);
  });
});

describe('checkDefaultKeys', () => {
  // plan-settings_dialog/REQ-34: the default keys of a row are accepted when no other row uses them
  it('accepts the default keys when they are free', () => {
    const store = new UserShortcutKeysStore();
    store.set('focus-list', { code: 'KeyK', modifiers: ['Alt'] });
    expect(checkDefaultKeys('focus-list', store)).toEqual(ACCEPTED);
    expect(checkDefaultKeys('terminal-larger-text', store)).toEqual(ACCEPTED);
  });

  // plan-settings_dialog/REQ-30, REQ-34, assumption "Restore default in conflict": a default key now used by another row is rejected with the same message
  it('rejects the default keys that another row now uses', () => {
    const store = new UserShortcutKeysStore();
    store.set('focus-list', { code: 'KeyK', modifiers: ['Alt'] });
    store.set('new-session', { code: 'KeyL', modifiers: ['Alt'] });
    expect(checkDefaultKeys('focus-list', store)).toEqual(rejected('Already used by New session dialog'));
  });

  // ShortcutKeyCheck contract: every default key of the row is checked, and a terminal row's saved character counts
  it('rejects a row when any of its default keys conflicts, the saved character of a terminal user key included', () => {
    const store = new UserShortcutKeysStore();
    store.set('terminal-larger-text', { code: 'KeyK', modifiers: ['Ctrl', 'Alt'], character: 'k' });
    store.set('terminal-smaller-text', { code: 'Equal', modifiers: ['Ctrl', 'Shift'], character: '+' });
    expect(checkDefaultKeys('terminal-larger-text', store)).toEqual(rejected('Already used by Smaller text'));
  });
});

describe('modifiersOfPress', () => {
  // ShortcutKeyCheck contract: Ctrl, Alt, Shift of a press, in this order
  it('gives Ctrl, Alt and Shift in this order, without Meta', () => {
    expect(modifiersOfPress(press('Shift+Alt+Ctrl+KeyK'))).toEqual(['Ctrl', 'Alt', 'Shift']);
    expect(modifiersOfPress(press('Shift+Alt+KeyK'))).toEqual(['Alt', 'Shift']);
    expect(modifiersOfPress(press('Meta+Ctrl+KeyK'))).toEqual(['Ctrl']);
    expect(modifiersOfPress(press('KeyK'))).toEqual([]);
  });
});
