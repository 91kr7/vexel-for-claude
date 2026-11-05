import { useState } from 'react';
import { RunningElsewhereWarning } from '../history/RunningElsewhereWarning';
import { LogInIcon } from '../icons/Icons';

interface ResumeHereButtonProps {
  sessionId: string;
  onResumed: (id: string) => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  session_not_found: 'La sessione non esiste più.',
  folder_not_found: 'La cartella del progetto non esiste.',
};
const GENERIC_ERROR = 'Operazione non riuscita.';

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
        setError(ERROR_MESSAGES[body?.error ?? ''] ?? GENERIC_ERROR);
        return;
      }
      const { id } = (await response.json()) as { id: string };
      onResumed(id);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" disabled={busy} onClick={() => setWarning(true)}>
        <LogInIcon />
        Riprendi qui
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
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
