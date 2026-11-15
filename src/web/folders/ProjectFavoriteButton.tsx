import { useLayoutEffect, useRef, useState } from 'react';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { StarIcon } from '../icons/Icons';

const FAVORITE_FAILED = 'Could not change the favorite mark.';

export function ProjectFavoriteButton({ folder, favorite }: { folder: string; favorite: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [pop, setPop] = useState(false);
  const markPressed = useRef(false);
  const label = favorite ? 'Remove Favorite' : 'Mark as Favorite';

  useLayoutEffect(() => {
    setPop(favorite && markPressed.current);
    if (favorite) markPressed.current = false;
  }, [favorite]);

  const fail = () => {
    markPressed.current = false;
    setError(true);
  };

  const toggle = async () => {
    if (busy) return;
    setError(false);
    setBusy(true);
    markPressed.current = !favorite;
    try {
      const response = await fetch('/api/projects/favorite', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder, favorite: !favorite }),
      });
      if (response.status !== 204) fail();
    } catch {
      fail();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`star-button project-favorite${favorite ? ' marked' : ''}${pop ? ' pop' : ''}`}
        aria-label={label}
        title={label}
        aria-disabled={busy || undefined}
        aria-busy={busy || undefined}
        onClick={() => void toggle()}
        onAnimationEnd={() => setPop(false)}
      >
        <StarIcon filled={favorite} />
      </button>
      {error && <ErrorMessage className="entry-favorite-error">{FAVORITE_FAILED}</ErrorMessage>}
    </>
  );
}
