import { useEffect, useRef } from 'react';
import { type ShortcutCommand, shortcutCommandOf } from './shortcut-map';

function dialogOpen(): boolean {
  return document.querySelector('[aria-modal="true"]') !== null;
}

export function useShortcutKeys(run: (command: ShortcutCommand) => void): void {
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = shortcutCommandOf(event);
      if (!command || dialogOpen()) return;
      event.preventDefault();
      event.stopPropagation();
      runRef.current(command);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);
}
