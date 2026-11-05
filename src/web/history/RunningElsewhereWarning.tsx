import { WarningDialog } from '../dialogs/WarningDialog';

interface RunningElsewhereWarningProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function RunningElsewhereWarning({ onConfirm, onCancel }: RunningElsewhereWarningProps) {
  return (
    <WarningDialog
      accent="attn"
      title="Sessione in esecuzione in un terminale"
      description="Questa sessione è ancora in esecuzione in un altro terminale. Se la riprendi anche qui, le due istanze possono danneggiare la conversazione."
      primaryLabel="Riprendi comunque"
      onPrimary={onConfirm}
      onCancel={onCancel}
    />
  );
}
