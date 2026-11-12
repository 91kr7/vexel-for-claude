import { useState } from 'react';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { StarIcon } from '../icons/Icons';

const FAVORITE_FAILED = 'Could not change the favorite mark.';

export function ProjectFavoriteButton({ folder, favorite }: { folder: string; favorite: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const label = favorite ? 'Remove Favorite' : 'Mark as Favorite';

  const toggle = async () => {
    if (busy) return;
    setError(false);
    setBusy(true);
    try {
      const response = await fetch('/api/projects/favorite', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder, favorite: !favorite }),
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
        className="entry-favorite project-favorite"
        aria-label={label}
        title={label}
        aria-disabled={busy || undefined}
        aria-busy={busy || undefined}
        onClick={() => void toggle()}
      >
        <StarIcon filled={favorite} />
      </button>
      {error && <ErrorMessage className="entry-favorite-error">{FAVORITE_FAILED}</ErrorMessage>}
    </>
  );
}
