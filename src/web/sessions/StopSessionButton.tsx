import { useState } from 'react';
import { WarningDialog } from '../dialogs/WarningDialog';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { Spinner } from '../feedback/ProgressIndicator';
import { PowerIcon } from '../icons/Icons';
import type { SessionState } from './live-session-store';

interface StopSessionButtonProps {
  sessionId: string;
  state: SessionState | undefined;
}

export function StopSessionButton({ sessionId, state }: StopSessionButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [failed, setFailed] = useState(false);

  if (state === 'ended') return null;

  const stop = async () => {
    setConfirming(false);
    setFailed(false);
    setStopping(true);
    // On success the button stays busy until the state becomes "ended".
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/stop`, { method: 'POST' });
      if (!response.ok) throw new Error(String(response.status));
    } catch {
      setStopping(false);
      setFailed(true);
    }
  };

  return (
    <>
      <button
        type="button"
        className="button-danger"
        disabled={stopping}
        aria-busy={stopping || undefined}
        onClick={() => (state === 'working' ? setConfirming(true) : void stop())}
      >
        {stopping ? <Spinner /> : <PowerIcon />}
        Termina
      </button>
      {failed && <ErrorMessage>Terminazione della sessione non riuscita.</ErrorMessage>}
      {confirming && (
        <WarningDialog
          title="Terminare la sessione?"
          description="La sessione è in lavorazione. Il lavoro in corso si interrompe."
          primaryLabel="Termina"
          onPrimary={() => void stop()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
