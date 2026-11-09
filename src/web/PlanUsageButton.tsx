import type { KeyboardEvent, MouseEvent } from 'react';
import { GaugeIcon } from './icons/Icons';

const NAME = 'Plan Usage';

// A click must not take the focus, so the terminal or the panel keeps it.
function keepFocus(event: MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
}

export function PlanUsageButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const closeOnEscape = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Escape' || !open) return;
    event.preventDefault();
    onToggle();
  };
  return (
    <button
      type="button"
      className="vx-surface-1 theme-switch plan-usage-button"
      aria-label={NAME}
      title={NAME}
      aria-haspopup="dialog"
      aria-expanded={open}
      onMouseDown={keepFocus}
      onKeyDown={closeOnEscape}
      onClick={onToggle}
    >
      <GaugeIcon />
    </button>
  );
}
