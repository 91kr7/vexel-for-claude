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
      title="Nessuna sessione aperta."
      text="Avvia una nuova sessione o riprendine una passata."
      actions={
        <>
          <button type="button" className="button-primary" onClick={onNewSession}>
            <PlusIcon />
            Nuova sessione
          </button>
          <button type="button" className="button-neutral" onClick={onResumeSession}>
            <HistoryIcon />
            Riprendi sessione
          </button>
        </>
      }
    />
  );
}
