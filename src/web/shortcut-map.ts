import type { NavigationTarget } from './sessions/navigation-targets';
import type { SessionCommand } from './shortcut-channel';
import { pageUserShortcutKeys, type UserShortcutKeysStore } from './user-shortcut-keys';

export type ShortcutArea = 'navigation' | 'sessions' | 'terminal' | 'general';

export type ShortcutModifier = 'Ctrl' | 'Alt' | 'Shift';

export type ShortcutCommand =
  | { kind: 'focus-list' }
  | { kind: 'focus-main-view' }
  | { kind: 'open-session'; target: NavigationTarget }
  | { kind: 'new-session' }
  | { kind: 'resume-history' }
  | { kind: 'session-command'; command: SessionCommand }
  | { kind: 'toggle-theme' }
  | { kind: 'open-shortcut-settings' };

export interface TerminalCommand {
  kind: 'terminal';
}

export interface ShortcutKey {
  code: string;
  modifiers: readonly ShortcutModifier[];
  command: ShortcutCommand | TerminalCommand;
  byCharacter?: boolean;
  character?: string;
}

const POSITIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export type TerminalShortcutId = 'terminal-search' | 'terminal-larger-text' | 'terminal-smaller-text' | 'terminal-default-text' | 'terminal-focus-list';

export type ShortcutId =
  | 'focus-list'
  | 'focus-main-view'
  | 'previous-session'
  | 'next-session'
  | `session-at-${(typeof POSITIONS)[number]}`
  | 'next-needs-input'
  | 'new-session'
  | 'resume-history'
  | 'rename-session'
  | 'resume-session'
  | 'stop-session'
  | 'dismiss-session'
  | TerminalShortcutId
  | 'toggle-theme'
  | 'shortcut-settings';

export interface Shortcut {
  id: ShortcutId;
  area: ShortcutArea;
  action: string;
  keys: readonly ShortcutKey[];
}

const alt = (code: string, command: ShortcutCommand): ShortcutKey => ({ code, modifiers: ['Alt'], command });
const altShift = (code: string, command: ShortcutCommand): ShortcutKey => ({ code, modifiers: ['Alt', 'Shift'], command });
// SessionView matches these by the typed character, so `code` holds `KeyboardEvent.key`.
const terminal = (character: string, ...modifiers: ShortcutModifier[]): ShortcutKey => ({
  code: character,
  modifiers,
  command: { kind: 'terminal' },
  byCharacter: true,
});

export const SHORTCUTS: readonly Shortcut[] = [
  { id: 'focus-list', area: 'navigation', action: 'Focus the list', keys: [alt('KeyL', { kind: 'focus-list' })] },
  { id: 'focus-main-view', area: 'navigation', action: 'Focus the main view', keys: [alt('KeyC', { kind: 'focus-main-view' })] },
  {
    id: 'previous-session',
    area: 'navigation',
    action: 'Previous session',
    keys: [alt('ArrowUp', { kind: 'open-session', target: { kind: 'previous' } })],
  },
  { id: 'next-session', area: 'navigation', action: 'Next session', keys: [alt('ArrowDown', { kind: 'open-session', target: { kind: 'next' } })] },
  ...POSITIONS.map(
    (position): Shortcut => ({
      id: `session-at-${position}`,
      area: 'navigation',
      action: `Session at position ${position}`,
      keys: [alt(`Digit${position}`, { kind: 'open-session', target: { kind: 'position', position } })],
    }),
  ),
  {
    id: 'next-needs-input',
    area: 'navigation',
    action: 'Next session that needs input',
    keys: [alt('KeyI', { kind: 'open-session', target: { kind: 'next-needs-input' } })],
  },
  { id: 'new-session', area: 'sessions', action: 'New session dialog', keys: [alt('KeyN', { kind: 'new-session' })] },
  { id: 'resume-history', area: 'sessions', action: 'Resume history dialog', keys: [alt('KeyH', { kind: 'resume-history' })] },
  {
    id: 'rename-session',
    area: 'sessions',
    action: 'Rename the open session',
    keys: [alt('KeyE', { kind: 'session-command', command: 'rename' })],
  },
  {
    id: 'resume-session',
    area: 'sessions',
    action: '"Resume" or "Resume Here" on the open session',
    keys: [alt('KeyR', { kind: 'session-command', command: 'resume' })],
  },
  {
    id: 'stop-session',
    area: 'sessions',
    action: 'Stop the open hosted session',
    keys: [altShift('KeyQ', { kind: 'session-command', command: 'stop' })],
  },
  {
    id: 'dismiss-session',
    area: 'sessions',
    action: 'Dismiss the open ended session',
    keys: [altShift('KeyW', { kind: 'session-command', command: 'dismiss' })],
  },
  { id: 'terminal-search', area: 'terminal', action: 'Search', keys: [terminal('f', 'Ctrl', 'Shift')] },
  { id: 'terminal-larger-text', area: 'terminal', action: 'Larger text', keys: [terminal('=', 'Ctrl'), terminal('+', 'Ctrl')] },
  { id: 'terminal-smaller-text', area: 'terminal', action: 'Smaller text', keys: [terminal('-', 'Ctrl')] },
  { id: 'terminal-default-text', area: 'terminal', action: 'Default text size', keys: [terminal('0', 'Ctrl')] },
  { id: 'terminal-focus-list', area: 'terminal', action: 'Focus the list', keys: [terminal('l', 'Ctrl', 'Shift')] },
  { id: 'toggle-theme', area: 'general', action: 'Light/Dark theme', keys: [alt('KeyA', { kind: 'toggle-theme' })] },
  { id: 'shortcut-settings', area: 'general', action: 'Shortcut settings', keys: [alt('KeyS', { kind: 'open-shortcut-settings' })] },
];

const PUNCTUATION: Readonly<Record<string, string>> = {
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  IntlBackslash: '<',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Comma: ',',
  Period: '.',
  Slash: '/',
};

const NAMED_KEYS: Readonly<Record<string, string>> = {
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Escape: 'Esc',
  Delete: 'Del',
  Insert: 'Ins',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  NumpadEnter: 'Enter',
};

export function keyText(key: Pick<ShortcutKey, 'code' | 'byCharacter'>): string {
  if (key.byCharacter) return key.code.toUpperCase();
  const named = NAMED_KEYS[key.code] ?? PUNCTUATION[key.code];
  if (named) return named;
  if (/^Numpad\d$/.test(key.code)) return `Num ${key.code.slice(6)}`;
  return key.code.replace(/^(Key|Digit)/, '');
}

export function keysText(key: Pick<ShortcutKey, 'code' | 'modifiers' | 'byCharacter'>): string {
  return [...key.modifiers, keyText(key)].join('+');
}

function defaultRow(id: ShortcutId): Shortcut {
  const row = SHORTCUTS.find((candidate) => candidate.id === id);
  if (!row) throw new Error(`Unknown shortcut ${id}`);
  return row;
}

function withActiveKeys(row: Shortcut, store: UserShortcutKeysStore): Shortcut {
  const user = store.keyOf(row.id);
  const command = row.keys[0]?.command;
  if (!user || !command) return row;
  return { ...row, keys: [{ code: user.code, modifiers: [...user.modifiers], command, character: user.character }] };
}

export function shortcutRows(store: UserShortcutKeysStore = pageUserShortcutKeys()): readonly Shortcut[] {
  return SHORTCUTS.map((row) => withActiveKeys(row, store));
}

export function activeKeys(id: ShortcutId, store: UserShortcutKeysStore = pageUserShortcutKeys()): readonly ShortcutKey[] {
  return withActiveKeys(defaultRow(id), store).keys;
}

export function defaultKeys(id: ShortcutId): readonly ShortcutKey[] {
  return defaultRow(id).keys;
}

export function hasDefaultKeys(id: ShortcutId, store: UserShortcutKeysStore = pageUserShortcutKeys()): boolean {
  const current = activeKeys(id, store).map(keysText);
  const defaults = defaultKeys(id).map(keysText);
  return current.length === defaults.length && current.every((text, index) => text === defaults[index]);
}

export function rowKeysText(id: ShortcutId, store: UserShortcutKeysStore = pageUserShortcutKeys()): string {
  return activeKeys(id, store).map(keysText).join(' / ');
}

export function commandKeysText(kind: ShortcutCommand['kind'], store: UserShortcutKeysStore = pageUserShortcutKeys()): string[] {
  return shortcutRows(store)
    .flatMap((row) => row.keys)
    .filter((key) => key.command.kind === kind)
    .map(keysText);
}

export interface KeyPress {
  code?: string;
  key?: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  altGraph?: boolean;
}

export function pressOf(event: KeyboardEvent): KeyPress {
  return {
    code: event.code,
    key: event.key,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    metaKey: event.metaKey,
    altGraph: event.getModifierState('AltGraph'),
  };
}

export function keyMatches(key: ShortcutKey, press: KeyPress): boolean {
  const shift = key.modifiers.includes('Shift');
  if (key.byCharacter) {
    return (
      press.ctrlKey &&
      !press.altKey &&
      !press.metaKey &&
      (!shift || press.shiftKey) &&
      press.key !== undefined &&
      press.key.toLowerCase() === key.code
    );
  }
  return (
    press.code === key.code &&
    press.ctrlKey === key.modifiers.includes('Ctrl') &&
    press.altKey === key.modifiers.includes('Alt') &&
    press.shiftKey === shift &&
    !press.metaKey &&
    press.altGraph !== true
  );
}

export function shortcutCommandOf(event: KeyboardEvent, store: UserShortcutKeysStore = pageUserShortcutKeys()): ShortcutCommand | null {
  const press = pressOf(event);
  for (const shortcut of shortcutRows(store)) {
    const key = shortcut.keys.find((candidate) => candidate.command.kind !== 'terminal' && keyMatches(candidate, press));
    if (key && key.command.kind !== 'terminal') return key.command;
  }
  return null;
}

export function terminalShortcutOf(event: KeyboardEvent, store: UserShortcutKeysStore = pageUserShortcutKeys()): TerminalShortcutId | null {
  const press = pressOf(event);
  for (const shortcut of shortcutRows(store)) {
    if (shortcut.area !== 'terminal') continue;
    if (shortcut.keys.some((key) => keyMatches(key, press))) return shortcut.id as TerminalShortcutId;
  }
  return null;
}
