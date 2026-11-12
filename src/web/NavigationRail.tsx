import type { Ref } from 'react';
import { FolderIcon, HistoryIcon, PlusIcon, TerminalIcon } from './icons/Icons';

export type SideView = 'sessions' | 'projects';

interface NavigationRailProps {
  needsInputCount: number;
  onNewSession: () => void;
  onShowSessions: () => void;
  onShowProjects?: () => void;
  onResume: () => void;
  newSessionRef?: Ref<HTMLButtonElement>;
  shownView?: SideView;
}

function Tooltip({ text }: { text: string }) {
  return (
    <span className="vx-tooltip" aria-hidden="true">
      {text}
    </span>
  );
}

function destinationProps(active: boolean) {
  return active ? { className: 'vx-rail-btn active', 'aria-current': 'page' as const } : { className: 'vx-rail-btn' };
}

export function NavigationRail({
  needsInputCount,
  onNewSession,
  onShowSessions,
  onShowProjects,
  onResume,
  newSessionRef,
  shownView = 'sessions',
}: NavigationRailProps) {
  return (
    <nav className="nav-rail" aria-label="Main Navigation">
      <button type="button" className="vx-rail-fab" aria-label="New Claude Code Session" ref={newSessionRef} onClick={onNewSession}>
        <PlusIcon />
        <Tooltip text="New Claude Code Session" />
      </button>
      <div className="nav-rail-divider" />
      <button type="button" {...destinationProps(shownView === 'sessions')} aria-label="Sessions" onClick={onShowSessions}>
        <TerminalIcon />
        {needsInputCount > 0 && (
          <span className="nav-rail-badge" aria-hidden="true">
            {needsInputCount}
          </span>
        )}
        <Tooltip text="Sessions" />
      </button>
      <button type="button" {...destinationProps(shownView === 'projects')} aria-label="Projects" onClick={onShowProjects}>
        <FolderIcon />
        <Tooltip text="Projects" />
      </button>
      <button type="button" className="vx-rail-btn" aria-label="Resume" onClick={onResume}>
        <HistoryIcon />
        <Tooltip text="Resume" />
      </button>
    </nav>
  );
}
