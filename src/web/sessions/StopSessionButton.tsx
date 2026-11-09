import { useState } from 'react';
import { WarningDialog } from '../dialogs/WarningDialog';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { Spinner } from '../feedback/ProgressIndicator';
import { useSessionCommand } from '../shortcut-channel';
import type { SessionState } from './live-session-store';

const STILL_WORKING = ' is still working. The current turn will be interrupted. You can resume the conversation from the history.';

interface StopSessionButtonProps {
  sessionId: string;
  state: SessionState | undefined;
  folderName?: string | undefined;
}

export function StopSessionButton({ sessionId, state, folderName }: StopSessionButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [failed, setFailed] = useState(false);

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
  const terminate = () => (state === 'working' ? setConfirming(true) : void stop());

  useSessionCommand('stop', terminate, state !== 'ended' && !stopping);

  if (state === 'ended') return null;

  return (
    <>
      <button
        type="button"
        className="button-danger stop-session-button"
        disabled={stopping}
        aria-busy={stopping || undefined}
        onClick={terminate}
      >
        {stopping ? (
          <Spinner />
        ) : (
          <span className="stop-glyph" aria-hidden="true">
            ■
          </span>
        )}
        Terminate
      </button>
      {failed && <ErrorMessage>Could not terminate the session.</ErrorMessage>}
      {confirming && (
        <WarningDialog
          title="Terminate the Session?"
          description={
            <>
              {folderName ? <b>{folderName}</b> : 'The session'}
              {STILL_WORKING}
            </>
          }
          primaryLabel="Terminate"
          onPrimary={() => void stop()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
