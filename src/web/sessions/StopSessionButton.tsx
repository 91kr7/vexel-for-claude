import { useState } from 'react';
import { WarningDialog } from '../dialogs/WarningDialog';
import { PowerIcon } from '../icons/Icons';
import type { SessionState } from './live-session-store';

interface StopSessionButtonProps {
  sessionId: string;
  state: SessionState | undefined;
}

export function StopSessionButton({ sessionId, state }: StopSessionButtonProps) {
  const [confirming, setConfirming] = useState(false);

  if (state === 'ended') return null;

  const stop = () => {
    setConfirming(false);
    void fetch(`/api/sessions/${encodeURIComponent(sessionId)}/stop`, { method: 'POST' }).catch(() => {});
  };

  return (
    <>
      <button
        type="button"
        className="button-danger"
        onClick={() => (state === 'working' ? setConfirming(true) : stop())}
      >
        <PowerIcon />
        Termina
      </button>
      {confirming && (
        <WarningDialog
          title="Terminare la sessione?"
          description="La sessione è in lavorazione. Il lavoro in corso si interrompe."
          primaryLabel="Termina"
          onPrimary={stop}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
