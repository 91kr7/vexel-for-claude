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

export function RepositoryList({ repositories }: { repositories: readonly CoveredRepository[] }) {
  return (
    <ul className="git-repository-list" aria-label="Repositories">
      {repositories.map((repository, index) => (
        <li key={repository.root} className="git-repository-entry" title={repository.root}>
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
        </li>
      ))}
    </ul>
  );
}
