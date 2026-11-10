import { useId, useState } from 'react';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { ProgressIndicator } from '../feedback/ProgressIndicator';
import { GitBranchIcon } from '../icons/Icons';
import { ChangesTab } from './ChangesTab';
import { useChanges, type ChangesState } from './changes-store';
import { HistoryTab } from './HistoryTab';
import { useHistory, type HistoryState } from './history-store';
import type { BranchInfo, RepositoryLookupState } from './repository-lookup-store';

const NAME = 'Git Explorer';

type Tab = 'changes' | 'history';

const TABS: { tab: Tab; title: string }[] = [
  { tab: 'changes', title: 'Changes' },
  { tab: 'history', title: 'History' },
];

const folderNameOf = (root: string) => root.split('/').filter(Boolean).pop() ?? root;

const branchText = (branch: BranchInfo) => (branch.kind === 'branch' ? branch.name : `detached ${branch.hash}`);

function ChangesBody({ root, changes }: { root: string; changes: ChangesState }) {
  if (changes.status === 'loading') return <ProgressIndicator className="git-explorer-message" />;
  if (changes.status === 'error') return <ErrorMessage className="git-explorer-error">{changes.message}</ErrorMessage>;
  if (changes.changes.length === 0) return <p className="git-explorer-message">No uncommitted changes</p>;
  return <ChangesTab root={root} changes={changes.changes} />;
}

function HistoryBody({ root, history, onLoadMore }: { root: string; history: HistoryState; onLoadMore: () => void }) {
  if (history.status === 'idle') return null;
  if (history.status === 'loading') return <ProgressIndicator className="git-explorer-message" />;
  if (history.status === 'error') return <ErrorMessage className="git-explorer-error">{history.message}</ErrorMessage>;
  return (
    <HistoryTab
      root={root}
      commits={history.commits}
      hasMore={history.hasMore}
      loadingMore={history.loadingMore}
      moreError={history.moreError}
      onLoadMore={onLoadMore}
    />
  );
}

export function GitExplorerPanel({ lookup }: { lookup: RepositoryLookupState }) {
  const root = lookup.status === 'repository' ? lookup.root : undefined;
  const changes = useChanges(root);
  const [tab, setTab] = useState<Tab>('changes');
  const [historyOpened, setHistoryOpened] = useState(false);
  const { history, loadMore } = useHistory(historyOpened ? root : undefined);
  const idPrefix = useId();
  const tabId = (id: Tab) => `${idPrefix}-tab-${id}`;
  const panelId = (id: Tab) => `${idPrefix}-tabpanel-${id}`;

  const open = (next: Tab) => {
    setTab(next);
    if (next === 'history') setHistoryOpened(true);
  };

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
      {root !== undefined && (
        <>
          <div className="git-explorer-tabs" role="tablist" aria-label="Git Explorer views">
            {TABS.map(({ tab: id, title }) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={tabId(id)}
                aria-selected={tab === id}
                aria-controls={panelId(id)}
                className={tab === id ? 'git-explorer-tab selected' : 'git-explorer-tab'}
                onClick={() => open(id)}
              >
                {title}
              </button>
            ))}
          </div>
          <div
            className="git-explorer-tabpanel"
            role="tabpanel"
            id={panelId('changes')}
            aria-labelledby={tabId('changes')}
            hidden={tab !== 'changes'}
          >
            <ChangesBody root={root} changes={changes} />
          </div>
          <div
            className="git-explorer-tabpanel"
            role="tabpanel"
            id={panelId('history')}
            aria-labelledby={tabId('history')}
            hidden={tab !== 'history'}
          >
            <HistoryBody root={root} history={history} onLoadMore={loadMore} />
          </div>
        </>
      )}
      {lookup.status === 'error' && <ErrorMessage className="git-explorer-error">{lookup.message}</ErrorMessage>}
    </section>
  );
}
