import type { Ref } from 'react';
import { HistoryIcon, PlusIcon, TerminalIcon } from './icons/Icons';

interface NavigationRailProps {
  needsInputCount: number;
  onNewSession: () => void;
  onShowSessions: () => void;
  onResume: () => void;
  newSessionRef?: Ref<HTMLButtonElement>;
}

function Tooltip({ text }: { text: string }) {
  return (
    <span className="vx-tooltip" aria-hidden="true">
      {text}
    </span>
  );
}

export function NavigationRail({ needsInputCount, onNewSession, onShowSessions, onResume, newSessionRef }: NavigationRailProps) {
  return (
    <nav className="nav-rail" aria-label="Main Navigation">
      <button type="button" className="vx-rail-fab" aria-label="New Claude Code Session" ref={newSessionRef} onClick={onNewSession}>
        <PlusIcon />
        <Tooltip text="New Claude Code Session" />
      </button>
      <div className="nav-rail-divider" />
      <button type="button" className="vx-rail-btn active" aria-label="Sessions" aria-current="page" onClick={onShowSessions}>
        <TerminalIcon />
        {needsInputCount > 0 && (
          <span className="nav-rail-badge" aria-hidden="true">
            {needsInputCount}
          </span>
        )}
        <Tooltip text="Sessions" />
      </button>
      <button type="button" className="vx-rail-btn" aria-label="Resume" onClick={onResume}>
        <HistoryIcon />
        <Tooltip text="Resume" />
      </button>
    </nav>
  );
}
