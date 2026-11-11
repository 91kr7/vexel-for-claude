import { StarIcon } from '../icons/Icons';

const FAVORITE_LABEL = 'Favorite';

export function FavoriteIndicator() {
  return (
    <span className="favorite-indicator" role="img" aria-label={FAVORITE_LABEL} title={FAVORITE_LABEL}>
      <StarIcon filled />
    </span>
  );
}
