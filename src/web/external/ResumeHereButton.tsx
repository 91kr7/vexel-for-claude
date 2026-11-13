import { useState } from 'react';
import { RunningElsewhereWarning } from '../history/RunningElsewhereWarning';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { Spinner } from '../feedback/ProgressIndicator';
import { LogInIcon } from '../icons/Icons';
import { useSessionCommand } from '../shortcut-channel';

interface ResumeHereButtonProps {
  sessionId: string;
  onResumed: (id: string) => void;
  /** The session has ended: it runs nowhere, so no running-elsewhere warning. */
  ended?: boolean;
}

const ERROR_MESSAGES: Record<string, string> = {
  session_not_found: 'The session no longer exists.',
  folder_not_found: 'The project folder does not exist.',
};
const RESUME_FAILED = 'Could not resume the session.';

export function ResumeHereButton({ sessionId, onResumed, ended = false }: ResumeHereButtonProps) {
  const [warning, setWarning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resume = async () => {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(`/api/past-sessions/${encodeURIComponent(sessionId)}/resume`, { method: 'POST' });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(ERROR_MESSAGES[body?.error ?? ''] ?? RESUME_FAILED);
        return;
      }
      const { id } = (await response.json()) as { id: string };
      onResumed(id);
    } catch {
      setError(RESUME_FAILED);
    } finally {
      setBusy(false);
    }
  };

  const start = () => (ended ? void resume() : setWarning(true));

  useSessionCommand('resume', start, !busy);

  return (
    <>
      <button type="button" className="button-primary button-bar resume-here-button" disabled={busy} aria-busy={busy || undefined} onClick={start}>
        {busy ? <Spinner /> : <LogInIcon />}
        Resume Here
      </button>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {warning && (
        <RunningElsewhereWarning
          onConfirm={() => {
            setWarning(false);
            void resume();
          }}
          onCancel={() => setWarning(false)}
        />
      )}
    </>
  );
}
