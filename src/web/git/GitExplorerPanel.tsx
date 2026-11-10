import { ErrorMessage } from '../feedback/ErrorMessage';
import { ProgressIndicator } from '../feedback/ProgressIndicator';
import { GitBranchIcon } from '../icons/Icons';
import { ChangesTab } from './ChangesTab';
import { useChanges, type ChangesState } from './changes-store';
import type { BranchInfo, RepositoryLookupState } from './repository-lookup-store';

const NAME = 'Git Explorer';

const folderNameOf = (root: string) => root.split('/').filter(Boolean).pop() ?? root;

const branchText = (branch: BranchInfo) => (branch.kind === 'branch' ? branch.name : `detached ${branch.hash}`);

function ChangesBody({ root, changes }: { root: string; changes: ChangesState }) {
  if (changes.status === 'loading') return <ProgressIndicator className="git-explorer-message" />;
  if (changes.status === 'error') return <ErrorMessage className="git-explorer-error">{changes.message}</ErrorMessage>;
  if (changes.changes.length === 0) return <p className="git-explorer-message">No uncommitted changes</p>;
  return <ChangesTab root={root} changes={changes.changes} />;
}

export function GitExplorerPanel({ lookup }: { lookup: RepositoryLookupState }) {
  const root = lookup.status === 'repository' ? lookup.root : undefined;
  const changes = useChanges(root);

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
      {root !== undefined && <ChangesBody root={root} changes={changes} />}
      {lookup.status === 'error' && <ErrorMessage className="git-explorer-error">{lookup.message}</ErrorMessage>}
    </section>
  );
}
