import { HistoryIcon, PlusIcon, SquareTerminalIcon } from './icons/Icons';

interface EmptyStateProps {
  onNewSession: () => void;
  onResumeSession: () => void;
}

export function EmptyState({ onNewSession, onResumeSession }: EmptyStateProps) {
  return (
    <section className="app-empty-state">
      <span className="app-empty-state-icon">
        <SquareTerminalIcon />
      </span>
      <p className="app-empty-state-title title-l">Nessuna sessione aperta.</p>
      <p className="app-empty-state-hint body-m">Avvia una nuova sessione o riprendine una passata.</p>
      <div className="app-empty-state-actions">
        <button type="button" className="btn label-l app-empty-state-new" onClick={onNewSession}>
          <PlusIcon />
          Nuova sessione
        </button>
        <button type="button" className="btn label-l app-empty-state-resume" onClick={onResumeSession}>
          <HistoryIcon />
          Riprendi sessione
        </button>
      </div>
    </section>
  );
}
