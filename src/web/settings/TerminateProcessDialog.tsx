import { WarningDialog } from '../dialogs/WarningDialog';
import type { ProcessRow } from './processes-client';
import { PROCESS_KIND_TEXTS } from './process-kind-texts';

interface TerminateProcessDialogProps {
  row: ProcessRow;
  onConfirm: () => void;
  onCancel: () => void;
}

const CURRENT_INSTANCE_TEXT = 'This is the instance you are using. Terminating it closes the app and ends every session it hosts.';
const SERVER_TEXT = 'The sessions it hosts end too.';

function warningText(row: ProcessRow): string | undefined {
  if (row.thisInstance) return CURRENT_INSTANCE_TEXT;
  return row.kind === 'app-server' || row.kind === 'test-server' ? SERVER_TEXT : undefined;
}

export function TerminateProcessDialog({ row, onConfirm, onCancel }: TerminateProcessDialogProps) {
  const detail = row.port !== undefined ? ` · port ${row.port}` : row.label !== undefined ? ` · ${row.label}` : '';
  const text = warningText(row);
  return (
    <WarningDialog
      title="Terminate the Process?"
      description={
        <>
          <b>
            {PROCESS_KIND_TEXTS[row.kind]} · PID {row.pid}
          </b>
          {detail}
          {text !== undefined && (
            <>
              <br />
              {text}
            </>
          )}
        </>
      }
      primaryLabel="Terminate"
      onPrimary={onConfirm}
      onCancel={onCancel}
    />
  );
}
