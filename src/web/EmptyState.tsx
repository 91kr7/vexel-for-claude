import { AreaState } from './feedback/AreaState';
import { HistoryIcon, PlusIcon } from './icons/Icons';

interface EmptyStateProps {
  onNewSession: () => void;
  onResumeSession: () => void;
}

export function EmptyState({ onNewSession, onResumeSession }: EmptyStateProps) {
  return (
    <AreaState
      kind="empty"
      className="app-empty-state"
      title="No open session."
      text="Start a new session or resume a past one."
      actions={
        <>
          <button type="button" className="button-primary" onClick={onNewSession}>
            <PlusIcon />
            New Session
          </button>
          <button type="button" className="button-neutral" onClick={onResumeSession}>
            <HistoryIcon />
            Resume Session
          </button>
        </>
      }
    />
  );
}
