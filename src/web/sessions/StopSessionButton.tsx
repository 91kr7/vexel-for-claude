import { useState } from 'react';
import { WarningDialog } from '../dialogs/WarningDialog';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { Spinner } from '../feedback/ProgressIndicator';
import type { SessionState } from './live-session-store';

const STILL_WORKING = ' sta ancora lavorando. Il turno in corso verrà interrotto; potrai riprendere la conversazione dalla cronologia.';

interface StopSessionButtonProps {
  sessionId: string;
  state: SessionState | undefined;
  folderName?: string | undefined;
}

export function StopSessionButton({ sessionId, state, folderName }: StopSessionButtonProps) {
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
        className="button-danger stop-session-button"
        disabled={stopping}
        aria-busy={stopping || undefined}
        onClick={() => (state === 'working' ? setConfirming(true) : void stop())}
      >
        {stopping ? (
          <Spinner />
        ) : (
          <span className="stop-glyph" aria-hidden="true">
            ■
          </span>
        )}
        Termina
      </button>
      {failed && <ErrorMessage>Terminazione della sessione non riuscita.</ErrorMessage>}
      {confirming && (
        <WarningDialog
          title="Terminare la sessione?"
          description={
            <>
              {folderName ? <b>{folderName}</b> : 'La sessione'}
              {STILL_WORKING}
            </>
          }
          primaryLabel="Termina"
          onPrimary={() => void stop()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
