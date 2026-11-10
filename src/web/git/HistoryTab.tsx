import { useState } from 'react';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { CommitDetail } from './CommitDetail';
import { firstLineOf, formatCommitDate } from './commit-format';
import type { Commit } from './history-store';

interface HistoryTabProps {
  root: string;
  commits: Commit[];
  hasMore: boolean;
  loadingMore: boolean;
  moreError?: string;
  onLoadMore: () => void;
}

export function HistoryTab({ root, commits, hasMore, loadingMore, moreError, onLoadMore }: HistoryTabProps) {
  const [selected, setSelected] = useState<Commit>();

  if (commits.length === 0) return <p className="git-explorer-message">No commits yet</p>;
  return (
    <>
      {/* Hidden, not unmounted, so the list keeps its scroll while a commit is open. */}
      <div className="history-tab" hidden={selected !== undefined}>
        <ul className="history-list" aria-label="Commits">
          {commits.map((commit) => (
            <li key={commit.hash}>
              <button type="button" className="history-commit" onClick={() => setSelected(commit)}>
                <span className="history-commit-line">
                  <span className="history-commit-hash">{commit.shortHash}</span>
                  <span className="history-commit-subject" title={firstLineOf(commit.message)}>
                    {firstLineOf(commit.message)}
                  </span>
                </span>
                <span className="history-commit-meta">
                  {commit.author} · {formatCommitDate(commit.date)}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {moreError !== undefined && <ErrorMessage className="git-explorer-error">{moreError}</ErrorMessage>}
        {hasMore && (
          <div className="history-more">
            <button type="button" className="button-neutral" disabled={loadingMore} onClick={onLoadMore}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
      {selected !== undefined && <CommitDetail key={selected.hash} root={root} commit={selected} onBack={() => setSelected(undefined)} />}
    </>
  );
}
