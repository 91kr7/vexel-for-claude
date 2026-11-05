import { useState } from 'react';
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
      <button type="button" onClick={() => (state === 'working' ? setConfirming(true) : stop())}>
        Termina
      </button>
      {confirming && (
        <div className="modal-backdrop">
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="stop-session-title">
            <h2 id="stop-session-title">Terminare la sessione?</h2>
            <p>La sessione è in lavorazione. Il lavoro in corso si interrompe.</p>
            <div className="modal-actions">
              <button type="button" onClick={() => setConfirming(false)} autoFocus>
                Annulla
              </button>
              <button type="button" onClick={stop}>
                Termina
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
