import { GitBranchIcon } from '../icons/Icons';
import { repositoryColor } from './repository-colors';
import type { BranchInfo, CoveredRepository } from './repository-lookup-store';

const branchText = (branch: BranchInfo) => (branch.kind === 'branch' ? branch.name : `detached ${branch.hash}`);

export function BranchChip({ branch, className }: { branch: BranchInfo; className: string }) {
  return (
    <span className={`mono-chip vx-surface-2 ${className}`}>
      <GitBranchIcon />
      {branchText(branch)}
    </span>
  );
}

interface RepositoryListProps {
  repositories: readonly CoveredRepository[];
  /** Roots of the filter; empty means no filter. */
  chosen: readonly string[];
  onToggle: (root: string) => void;
  onClear: () => void;
}

export function RepositoryList({ repositories, chosen, onToggle, onClear }: RepositoryListProps) {
  return (
    <div className="git-repository-filter">
      <button type="button" className="git-repository-all" aria-pressed={chosen.length === 0} onClick={onClear}>
        All repositories
      </button>
      <ul className="git-repository-list" aria-label="Repositories">
        {repositories.map((repository, index) => (
          <li key={repository.root}>
            <button
              type="button"
              className="git-repository-entry"
              title={repository.root}
              aria-pressed={chosen.includes(repository.root)}
              onClick={() => onToggle(repository.root)}
            >
              <span className="git-repository-mark" style={{ backgroundColor: repositoryColor(index) }} aria-hidden="true" />
              <span className="git-repository-name">{repository.name}</span>
              <span className="git-repository-path">{repository.path}</span>
              {'branch' in repository ? (
                <BranchChip branch={repository.branch} className="git-repository-branch" />
              ) : (
                <span className="git-repository-error" title={repository.error}>
                  {repository.error}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
