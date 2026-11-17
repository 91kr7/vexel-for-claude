import { useId, useMemo, useState } from 'react';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { ProgressIndicator } from '../feedback/ProgressIndicator';
import { RefreshCwIcon } from '../icons/Icons';
import { useLeaving } from '../motion/ExitPresence';
import type { SessionSummary } from '../sessions/live-session-store';
import { ChangesTab } from './ChangesTab';
import { useChanges, type ChangesState } from './changes-store';
import { HistoryTab, type HistoryRepository } from './HistoryTab';
import { useHistory, type HistoryState } from './history-store';
import { repositoryColor } from './repository-colors';
import { useRepositoryFilter } from './repository-filter-store';
import type { CoveredRepository, RepositoryLookupState } from './repository-lookup-store';
import { BranchChip, RepositoryList } from './RepositoryList';
import { useTurnEndSignal } from './turn-end-watcher';

const NAME = 'Git Explorer';

type Tab = 'changes' | 'history';

const TABS: { tab: Tab; title: string }[] = [
  { tab: 'changes', title: 'Changes' },
  { tab: 'history', title: 'History' },
];

function ChangesBody({
  repositories,
  changes,
  colors,
  several,
}: {
  repositories: readonly CoveredRepository[];
  changes: readonly ChangesState[];
  colors: readonly string[];
  several: boolean;
}) {
  if (changes.some((state) => state.status === 'loading')) return <ProgressIndicator className="git-explorer-message" />;
  return <ChangesTab repositories={repositories} changes={changes} colors={colors} several={several} />;
}

function HistoryBody({
  repositories,
  several,
  history,
  onLoadMore,
}: {
  repositories: readonly HistoryRepository[];
  several: boolean;
  history: HistoryState;
  onLoadMore: () => void;
}) {
  if (history.status === 'idle') return null;
  if (history.status === 'loading') return <ProgressIndicator className="git-explorer-message" />;
  const nameOf = (root: string) => repositories.find((repository) => repository.root === root)?.name;
  return (
    <>
      {history.errors.map(({ root, message }) => {
        const name = several ? nameOf(root) : undefined;
        return (
          <ErrorMessage key={root} className="git-explorer-error">
            {name === undefined ? message : `${name}: ${message}`}
          </ErrorMessage>
        );
      })}
      {history.errors.length < repositories.length && (
        <HistoryTab
          repositories={repositories}
          several={several}
          commits={history.commits}
          hasMore={history.hasMore}
          loadingMore={history.loadingMore}
          moreError={history.moreError}
          onLoadMore={onLoadMore}
        />
      )}
    </>
  );
}

const NO_SESSIONS: readonly SessionSummary[] = [];
const NO_REPOSITORIES: readonly CoveredRepository[] = [];
const NO_ROOTS: readonly string[] = [];

interface GitExplorerPanelProps {
  lookup: RepositoryLookupState;
  /** Project folder of the session; the repository filter is kept per folder. */
  folder?: string;
  /** Asks the owner to read the repository again. */
  onRefresh?: () => void;
  sessions?: readonly SessionSummary[];
}

export function GitExplorerPanel({ lookup, folder, onRefresh, sessions = NO_SESSIONS }: GitExplorerPanelProps) {
  const repositories = lookup.status === 'repositories' ? lookup.repositories : NO_REPOSITORIES;
  const single = repositories.length === 1 ? repositories[0] : undefined;
  const errorMessage = lookup.status === 'error' ? lookup.message : single !== undefined && 'error' in single ? single.error : undefined;
  const showTabs = errorMessage === undefined && repositories.length > 0;
  const several = repositories.length > 1;
  const roots = useMemo(() => repositories.map((repository) => repository.root), [repositories]);
  const filter = useRepositoryFilter(folder, roots);
  // The colour of a repository stays the one of its position in the full list.
  const shown = useMemo(() => {
    const colored = repositories.map((repository, index) => ({ repository, color: repositoryColor(index) }));
    return filter.chosen.length === 0 ? colored : colored.filter(({ repository }) => filter.chosen.includes(repository.root));
  }, [repositories, filter.chosen]);
  const shownRepositories = useMemo(() => shown.map(({ repository }) => repository), [shown]);
  const shownColors = useMemo(() => shown.map(({ color }) => color), [shown]);
  const shownRoots = useMemo(() => shownRepositories.map((repository) => repository.root), [shownRepositories]);
  const historyRepositories = useMemo<HistoryRepository[]>(
    () =>
      shown.map(({ repository, color }) => ({
        root: repository.root,
        name: repository.name,
        color,
        branch: 'branch' in repository ? repository.branch : undefined,
      })),
    [shown],
  );
  const [revision, setRevision] = useState(0);
  const refresh = () => {
    setRevision((current) => current + 1);
    onRefresh?.();
  };
  const changes = useChanges(showTabs ? shownRoots : NO_ROOTS, revision);
  const [tab, setTab] = useState<Tab>('changes');
  const [tabSwitched, setTabSwitched] = useState(false);
  const [historyOpened, setHistoryOpened] = useState(false);
  const { history, loadMore } = useHistory(showTabs && historyOpened ? shownRoots : NO_ROOTS, revision);
  useTurnEndSignal(sessions, roots, refresh);
  const idPrefix = useId();
  const leaving = useLeaving();
  const tabId = (id: Tab) => `${idPrefix}-tab-${id}`;
  const panelId = (id: Tab) => `${idPrefix}-tabpanel-${id}`;

  const tabPanelClass = tabSwitched ? 'git-explorer-tabpanel tab-panel-enter' : 'git-explorer-tabpanel';

  const open = (next: Tab) => {
    if (next !== tab) setTabSwitched(true);
    setTab(next);
    if (next === 'history') setHistoryOpened(true);
  };

  return (
    <section className={leaving ? 'git-explorer-panel is-leaving' : 'git-explorer-panel'} aria-label={NAME} aria-hidden={leaving || undefined}>
      {(lookup.status === 'repositories' || lookup.status === 'error') && (
        <header className={several ? 'git-explorer-header several' : 'git-explorer-header'}>
          {single !== undefined && (
            <>
              <h3 className="git-explorer-repository" title={single.root}>
                {single.name}
              </h3>
              {'branch' in single && <BranchChip branch={single.branch} className="git-explorer-branch" />}
            </>
          )}
          {several && <RepositoryList repositories={repositories} chosen={filter.chosen} onToggle={filter.toggle} onClear={filter.clear} />}
          <button type="button" className="session-search-button git-explorer-refresh" aria-label="Refresh" title="Refresh" onClick={refresh}>
            <RefreshCwIcon />
          </button>
        </header>
      )}
      {showTabs && (
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
            className={tabPanelClass}
            role="tabpanel"
            id={panelId('changes')}
            aria-labelledby={tabId('changes')}
            hidden={tab !== 'changes'}
          >
            <ChangesBody repositories={shownRepositories} changes={changes} colors={shownColors} several={several} />
          </div>
          <div
            className={tabPanelClass}
            role="tabpanel"
            id={panelId('history')}
            aria-labelledby={tabId('history')}
            hidden={tab !== 'history'}
          >
            <HistoryBody repositories={historyRepositories} several={several} history={history} onLoadMore={loadMore} />
          </div>
        </>
      )}
      {errorMessage !== undefined && <ErrorMessage className="git-explorer-error">{errorMessage}</ErrorMessage>}
    </section>
  );
}
