import type { NavigationTarget } from './sessions/navigation-targets';
import type { SessionCommand } from './shortcut-channel';

export type ShortcutArea = 'navigation' | 'sessions' | 'terminal' | 'general';

export type ShortcutModifier = 'Ctrl' | 'Alt' | 'Shift';

export type ShortcutCommand =
  | { kind: 'focus-list' }
  | { kind: 'focus-main-view' }
  | { kind: 'open-session'; target: NavigationTarget }
  | { kind: 'new-session' }
  | { kind: 'resume-history' }
  | { kind: 'session-command'; command: SessionCommand }
  | { kind: 'toggle-theme' };

export interface ShortcutKey {
  code: string;
  modifiers: readonly ShortcutModifier[];
  command: ShortcutCommand;
}

export interface Shortcut {
  area: ShortcutArea;
  action: string;
  keys: readonly ShortcutKey[];
}

const alt = (code: string, command: ShortcutCommand): ShortcutKey => ({ code, modifiers: ['Alt'], command });
const altShift = (code: string, command: ShortcutCommand): ShortcutKey => ({ code, modifiers: ['Alt', 'Shift'], command });

const POSITIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export const SHORTCUTS: readonly Shortcut[] = [
  { area: 'navigation', action: 'Focus the list', keys: [alt('KeyL', { kind: 'focus-list' })] },
  { area: 'navigation', action: 'Focus the main view', keys: [alt('KeyC', { kind: 'focus-main-view' })] },
  {
    area: 'navigation',
    action: 'Previous / next session',
    keys: [
      alt('ArrowUp', { kind: 'open-session', target: { kind: 'previous' } }),
      alt('ArrowDown', { kind: 'open-session', target: { kind: 'next' } }),
    ],
  },
  {
    area: 'navigation',
    action: 'Session at position 1 to 9',
    keys: POSITIONS.map((position) => alt(`Digit${position}`, { kind: 'open-session', target: { kind: 'position', position } })),
  },
  {
    area: 'navigation',
    action: 'Next session that needs input',
    keys: [alt('KeyI', { kind: 'open-session', target: { kind: 'next-needs-input' } })],
  },
  { area: 'sessions', action: 'New session dialog', keys: [alt('KeyN', { kind: 'new-session' })] },
  { area: 'sessions', action: 'Resume history dialog', keys: [alt('KeyH', { kind: 'resume-history' })] },
  { area: 'sessions', action: 'Rename the open session', keys: [alt('KeyE', { kind: 'session-command', command: 'rename' })] },
  {
    area: 'sessions',
    action: '"Resume" or "Resume Here" on the open session',
    keys: [alt('KeyR', { kind: 'session-command', command: 'resume' })],
  },
  { area: 'sessions', action: 'Stop the open hosted session', keys: [altShift('KeyQ', { kind: 'session-command', command: 'stop' })] },
  { area: 'sessions', action: 'Dismiss the open ended session', keys: [altShift('KeyW', { kind: 'session-command', command: 'dismiss' })] },
  { area: 'general', action: 'Light/Dark theme', keys: [alt('KeyA', { kind: 'toggle-theme' })] },
];

function matches(key: ShortcutKey, event: KeyboardEvent): boolean {
  return (
    event.code === key.code &&
    event.ctrlKey === key.modifiers.includes('Ctrl') &&
    event.altKey === key.modifiers.includes('Alt') &&
    event.shiftKey === key.modifiers.includes('Shift') &&
    !event.metaKey &&
    !event.getModifierState('AltGraph')
  );
}

export function shortcutCommandOf(event: KeyboardEvent): ShortcutCommand | null {
  for (const shortcut of SHORTCUTS) {
    const key = shortcut.keys.find((candidate) => matches(candidate, event));
    if (key) return key.command;
  }
  return null;
}
