interface RunningElsewhereWarningProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function RunningElsewhereWarning({ onConfirm, onCancel }: RunningElsewhereWarningProps) {
  return (
    <div className="modal-backdrop warning-backdrop">
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="running-elsewhere-title"
        aria-describedby="running-elsewhere-text"
      >
        <h2 id="running-elsewhere-title">Sessione in esecuzione in un terminale</h2>
        <p id="running-elsewhere-text">
          Questa sessione è ancora in esecuzione in un altro terminale. Se la riprendi anche qui, le due istanze possono
          danneggiare la conversazione.
        </p>
        <div className="modal-actions">
          <button type="button" onClick={onCancel} autoFocus>
            Annulla
          </button>
          <button type="button" onClick={onConfirm}>
            Riprendi comunque
          </button>
        </div>
      </div>
    </div>
  );
}
