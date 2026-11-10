import { GitBranchIcon } from '../icons/Icons';
import type { RepositoryLookupState } from './repository-lookup-store';

const NAME = 'Git Explorer';

interface GitExplorerButtonProps {
  lookup: RepositoryLookupState;
  open: boolean;
  onToggle: () => void;
}

export function GitExplorerButton({ lookup, open, onToggle }: GitExplorerButtonProps) {
  if (lookup.status !== 'repository' && lookup.status !== 'error') return null;
  return (
    <button
      type="button"
      className={open ? 'session-search-button git-explorer-button open' : 'session-search-button git-explorer-button'}
      aria-label={NAME}
      title={NAME}
      aria-expanded={open}
      onClick={onToggle}
    >
      <GitBranchIcon />
    </button>
  );
}
