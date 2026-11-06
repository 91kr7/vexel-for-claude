import { WarningDialog } from '../dialogs/WarningDialog';

interface RunningElsewhereWarningProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function RunningElsewhereWarning({ onConfirm, onCancel }: RunningElsewhereWarningProps) {
  return (
    <WarningDialog
      accent="attn"
      title="Session Running in a Terminal"
      description="This session is still running in another terminal. If you resume it here too, the two instances can damage the conversation."
      primaryLabel="Resume Anyway"
      onPrimary={onConfirm}
      onCancel={onCancel}
    />
  );
}
