import { useState } from 'react';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { StarIcon } from '../icons/Icons';

interface FavoriteButtonProps {
  sessionId: string;
  favorite: boolean;
  hidden?: boolean;
}

const FAVORITE_FAILED = 'Could not change the favorite mark.';

export function FavoriteButton({ sessionId, favorite, hidden = false }: FavoriteButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const label = favorite ? 'Remove Favorite' : 'Mark as Favorite';

  const toggle = async () => {
    if (busy) return;
    setError(false);
    setBusy(true);
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/favorite`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite: !favorite }),
      });
      if (!response.ok) setError(true);
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
        className="entry-favorite"
        aria-label={label}
        title={label}
        hidden={hidden}
        aria-disabled={busy || undefined}
        aria-busy={busy || undefined}
        onClick={() => void toggle()}
      >
        <StarIcon filled={favorite} />
      </button>
      {error && !hidden && <ErrorMessage className="entry-favorite-error">{FAVORITE_FAILED}</ErrorMessage>}
    </>
  );
}
