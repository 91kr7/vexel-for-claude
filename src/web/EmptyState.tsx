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
      <p className="app-empty-state-title">Nessuna sessione aperta.</p>
      <p className="app-empty-state-hint">Avvia una nuova sessione o riprendine una passata.</p>
      <div className="app-empty-state-actions">
        <button type="button" className="button-primary" onClick={onNewSession}>
          <PlusIcon />
          Nuova sessione
        </button>
        <button type="button" onClick={onResumeSession}>
          <HistoryIcon />
          Riprendi sessione
        </button>
      </div>
    </section>
  );
}
