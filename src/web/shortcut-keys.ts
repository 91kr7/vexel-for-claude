import { useEffect, useRef } from 'react';
import { type ShortcutCommand, shortcutCommandOf } from './shortcut-map';

export const SHORTCUTS_PANEL_CLASS = 'shortcuts-panel';

function blockedByDialog(command: ShortcutCommand): boolean {
  const dialogs = [...document.querySelectorAll('[aria-modal="true"]')];
  if (dialogs.length === 0) return false;
  const onlyPanel = dialogs.every((dialog) => dialog.classList.contains(SHORTCUTS_PANEL_CLASS));
  return !(onlyPanel && command.kind === 'toggle-shortcuts-panel');
}

export function useShortcutKeys(run: (command: ShortcutCommand) => void): void {
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = shortcutCommandOf(event);
      if (!command || blockedByDialog(command)) return;
      event.preventDefault();
      event.stopPropagation();
      runRef.current(command);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);
}
