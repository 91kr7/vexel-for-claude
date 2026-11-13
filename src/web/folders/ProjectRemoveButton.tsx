import { useState } from 'react';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { XIcon } from '../icons/Icons';

const LABEL = 'Remove from Projects';
const REMOVE_FAILED = 'Could not remove the project.';

export function ProjectRemoveButton({ folder }: { folder: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const remove = async () => {
    if (busy) return;
    setError(false);
    setBusy(true);
    try {
      const response = await fetch('/api/projects/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder }),
      });
      if (response.status !== 204) setError(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="entry-favorite project-remove"
        aria-label={LABEL}
        title={LABEL}
        aria-disabled={busy || undefined}
        aria-busy={busy || undefined}
        onClick={() => void remove()}
      >
        <XIcon />
      </button>
      {error && <ErrorMessage className="entry-favorite-error">{REMOVE_FAILED}</ErrorMessage>}
    </>
  );
}
