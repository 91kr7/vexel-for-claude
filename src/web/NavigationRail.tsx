import type { Ref } from 'react';
import { HistoryIcon, PlusIcon, TerminalIcon } from './icons/Icons';

interface NavigationRailProps {
  needsInputCount: number;
  onNewSession: () => void;
  onShowSessions: () => void;
  onResume: () => void;
  newSessionRef?: Ref<HTMLButtonElement>;
}

export function NavigationRail({ needsInputCount, onNewSession, onShowSessions, onResume, newSessionRef }: NavigationRailProps) {
  return (
    <nav className="nav-rail" aria-label="Navigazione principale">
      <svg className="nav-rail-logo" viewBox="0 0 29 23" role="img" aria-label="Vexel">
        <rect x="0" y="0" width="5" height="5" rx="1.5" />
        <rect x="24" y="0" width="5" height="5" rx="1.5" />
        <rect x="0" y="6" width="5" height="5" rx="1.5" />
        <rect x="24" y="6" width="5" height="5" rx="1.5" />
        <rect x="6" y="12" width="5" height="5" rx="1.5" />
        <rect x="18" y="12" width="5" height="5" rx="1.5" />
        <rect className="nav-rail-logo-ember" x="12" y="18" width="5" height="5" rx="1.5" />
      </svg>
      <button type="button" className="nav-rail-fab" aria-label="Nuova sessione" ref={newSessionRef} onClick={onNewSession}>
        <PlusIcon />
      </button>
      <div className="nav-rail-spacer" />
      <button type="button" className="nav-rail-destination" aria-current="page" onClick={onShowSessions}>
        <span className="nav-rail-indicator">
          <TerminalIcon />
          {needsInputCount > 0 && (
            <span className="nav-rail-badge label-m" aria-hidden="true">
              {needsInputCount}
            </span>
          )}
        </span>
        <span className="label-m">Sessioni</span>
      </button>
      <button type="button" className="nav-rail-destination" onClick={onResume}>
        <span className="nav-rail-indicator">
          <HistoryIcon />
        </span>
        <span className="label-m">Riprendi</span>
      </button>
    </nav>
  );
}
