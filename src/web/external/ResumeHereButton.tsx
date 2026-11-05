import { useState } from 'react';
import { RunningElsewhereWarning } from '../history/RunningElsewhereWarning';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { Spinner } from '../feedback/ProgressIndicator';
import { LogInIcon } from '../icons/Icons';

interface ResumeHereButtonProps {
  sessionId: string;
  onResumed: (id: string) => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  session_not_found: 'La sessione non esiste più.',
  folder_not_found: 'La cartella del progetto non esiste.',
};
const RESUME_FAILED = 'Ripresa della sessione non riuscita.';

export function ResumeHereButton({ sessionId, onResumed }: ResumeHereButtonProps) {
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

  return (
    <>
      <button type="button" className="btn label-l resume-here-button" disabled={busy} aria-busy={busy || undefined} onClick={() => setWarning(true)}>
        {busy ? <Spinner /> : <LogInIcon />}
        Riprendi qui
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
