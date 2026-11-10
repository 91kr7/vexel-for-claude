import { ErrorMessage } from '../feedback/ErrorMessage';
import { GitBranchIcon } from '../icons/Icons';
import type { BranchInfo, RepositoryLookupState } from './repository-lookup-store';

const NAME = 'Git Explorer';

const folderNameOf = (root: string) => root.split('/').filter(Boolean).pop() ?? root;

const branchText = (branch: BranchInfo) => (branch.kind === 'branch' ? branch.name : `detached ${branch.hash}`);

export function GitExplorerPanel({ lookup }: { lookup: RepositoryLookupState }) {
  return (
    <section className="git-explorer-panel" aria-label={NAME}>
      {lookup.status === 'repository' && (
        <header className="git-explorer-header">
          <h3 className="git-explorer-repository" title={lookup.root}>
            {folderNameOf(lookup.root)}
          </h3>
          <span className="mono-chip vx-surface-2 git-explorer-branch">
            <GitBranchIcon />
            {branchText(lookup.branch)}
          </span>
        </header>
      )}
      {lookup.status === 'error' && <ErrorMessage className="git-explorer-error">{lookup.message}</ErrorMessage>}
    </section>
  );
}
