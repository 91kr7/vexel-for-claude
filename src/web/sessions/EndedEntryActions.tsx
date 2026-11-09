import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { Spinner } from '../feedback/ProgressIndicator';
import { RunningElsewhereWarning } from '../history/RunningElsewhereWarning';
import { HistoryIcon, XIcon } from '../icons/Icons';
import { useSessionCommand } from '../shortcut-channel';

interface EndedEntryActionsProps {
  sessionId: string;
  resumable: boolean;
  open?: boolean;
  onResumed?: (sessionId: string) => void;
}

type Action = 'dismiss' | 'resume';

const RESUME_ERRORS: Record<string, string> = {
  session_not_found: 'The session no longer exists.',
  folder_not_found: 'The project folder does not exist.',
};
const RESUME_FAILED = 'Could not resume the session.';
const DISMISS_FAILED = 'Could not dismiss the session.';

export function EndedEntryActions({ sessionId, resumable, open = false, onResumed }: EndedEntryActionsProps) {
  const [busy, setBusy] = useState<Action | null>(null);
  const [warning, setWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = `/api/sessions/${encodeURIComponent(sessionId)}`;

  const run = async (action: Action, request: () => Promise<void>, failure: string) => {
    if (busy) return;
    setError(null);
    setBusy(action);
    try {
      await request();
    } catch {
      setError(failure);
    } finally {
      setBusy(null);
    }
  };

  const dismiss = () =>
    run(
      'dismiss',
      async () => {
        const response = await fetch(`${url}/dismiss`, { method: 'POST' });
        if (!response.ok) setError(DISMISS_FAILED);
      },
      DISMISS_FAILED,
    );

  const resume = (force: boolean) =>
    run(
      'resume',
      async () => {
        const response = await fetch(`${url}/resume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(force ? { force: true } : {}),
        });
        const body = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;
        if (response.ok && typeof body?.id === 'string') onResumed?.(body.id);
        else if (response.status === 409 && body?.error === 'running_elsewhere' && !force) setWarning(true);
        else setError(RESUME_ERRORS[body?.error ?? ''] ?? RESUME_FAILED);
      },
      RESUME_FAILED,
    );

  useSessionCommand('dismiss', () => void dismiss(), open);
  useSessionCommand('resume', () => void resume(false), open && resumable);

  return (
    <>
      <div className={busy || warning ? 'ended-entry-actions shown' : 'ended-entry-actions'}>
        {resumable && (
          <button
            type="button"
            className="ended-entry-action"
            aria-label="Resume"
            title="Resume"
            aria-disabled={busy !== null || undefined}
            aria-busy={busy === 'resume' || undefined}
            onClick={() => void resume(false)}
          >
            {busy === 'resume' ? <Spinner /> : <HistoryIcon />}
          </button>
        )}
        <button
          type="button"
          className="ended-entry-action"
          aria-label="Dismiss"
          title="Dismiss"
          aria-disabled={busy !== null || undefined}
          aria-busy={busy === 'dismiss' || undefined}
          onClick={() => void dismiss()}
        >
          {busy === 'dismiss' ? <Spinner /> : <XIcon />}
        </button>
      </div>
      {error && <ErrorMessage className="ended-entry-error">{error}</ErrorMessage>}
      {warning &&
        // Outside the draggable list item, so a mouse move on the dialog cannot drag the entry.
        createPortal(
          <RunningElsewhereWarning
            onConfirm={() => {
              setWarning(false);
              void resume(true);
            }}
            onCancel={() => setWarning(false)}
          />,
          document.body,
        )}
    </>
  );
}
