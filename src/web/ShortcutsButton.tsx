import type { MouseEvent } from 'react';
import { KeyboardIcon } from './icons/Icons';

const NAME = 'Keyboard Shortcuts';

// A click must not take the focus, so the open panel keeps it.
function keepFocus(event: MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
}

export function ShortcutsButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="vx-surface-1 theme-switch shortcuts-button"
      aria-label={NAME}
      title={`${NAME} (Alt+S)`}
      aria-haspopup="dialog"
      aria-expanded={open}
      onMouseDown={keepFocus}
      onClick={onToggle}
    >
      <KeyboardIcon />
    </button>
  );
}
