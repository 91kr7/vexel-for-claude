import { useEffect, useRef } from 'react';
import { type ShortcutCommand, shortcutCommandOf } from './shortcut-map';

const isDialogOpen = () => document.querySelector('[aria-modal="true"]') !== null;

export function useShortcutKeys(run: (command: ShortcutCommand) => void): void {
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isDialogOpen()) return;
      const command = shortcutCommandOf(event);
      if (!command) return;
      event.preventDefault();
      event.stopPropagation();
      runRef.current(command);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);
}
