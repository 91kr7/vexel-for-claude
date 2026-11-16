import { memo, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { CommitGraph, type Commit as GraphCommit, type GraphStyle } from 'commit-graph';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { CommitDetail } from './CommitDetail';
import { firstLineOf, formatCommitDate } from './commit-format';
import type { Commit } from './history-store';
import type { BranchInfo } from './repository-lookup-store';

const LANE_TOKENS = ['--accent-primary', '--emerald-400', '--amber-400', '--rose-400', '--accent-secondary', '--orange-400'];
const FALLBACK_COLOR = '#808080';

/** Height of a commit row in px; the graph puts one commit per row. */
const ROW_HEIGHT = 28;
const NODE_RADIUS = 2;

const Graph = memo(CommitGraph);
const NO_BRANCH_HEADS: [] = [];

/**
 * The lane colours as concrete `rgb(...)` values: commit-graph parses them, so `var(...)` cannot reach it.
 * Read again when an attribute of the root element (theme, look) changes.
 */
function useLaneColors(ref: RefObject<HTMLElement | null>, mounted: boolean): string[] | undefined {
  const [colors, setColors] = useState<string[]>();
  useLayoutEffect(() => {
    const host = ref.current;
    if (host === null) return;
    const resolve = () => {
      const probe = document.createElement('span');
      probe.hidden = true;
      host.appendChild(probe);
      const next = LANE_TOKENS.map((token) => {
        probe.style.color = `var(${token})`;
        const color = getComputedStyle(probe).color;
        return /^(rgb\(|#)/.test(color) ? color : FALLBACK_COLOR;
      });
      probe.remove();
      setColors((current) => (current?.join() === next.join() ? current : next));
    };
    resolve();
    const observer = new MutationObserver(resolve);
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, [ref, mounted]);
  return colors;
}

/**
 * The data of commit-graph. Dates that count down keep it in the order of the list (git --date-order), one
 * commit per row; message and author stay empty, the rows show them. Each parent not loaded yet gets a
 * placeholder after the last commit, so its line runs past the last row, where the list clips the drawing.
 */
function toGraphCommits(commits: Commit[]): GraphCommit[] {
  const loaded = new Set(commits.map((commit) => commit.hash));
  const missing = new Set<string>();
  for (const commit of commits) for (const parent of commit.parents ?? []) if (!loaded.has(parent)) missing.add(parent);
  const nodes = [
    ...commits.map((commit) => ({ sha: commit.hash, parents: commit.parents ?? [] })),
    ...[...missing].map((sha) => ({ sha, parents: [] })),
  ];
  return nodes.map(({ sha, parents }, index) => ({
    sha,
    commit: { author: { name: '', date: nodes.length - index }, message: '' },
    parents: parents.map((parent) => ({ sha: parent })),
  }));
}

interface HistoryTabProps {
  root: string;
  commits: Commit[];
  hasMore: boolean;
  loadingMore: boolean;
  moreError?: string;
  onLoadMore: () => void;
  /** Branch of the repository; its name, or "detached", labels the first commit. */
  branch?: BranchInfo;
}

export function HistoryTab({ root, commits, hasMore, loadingMore, moreError, onLoadMore, branch }: HistoryTabProps) {
  const [selected, setSelected] = useState<Commit>();
  if (selected !== undefined && !commits.some((commit) => commit.hash === selected.hash)) setSelected(undefined);
  const listRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const colors = useLaneColors(listRef, commits.length > 0);
  const graphCommits = useMemo(() => toGraphCommits(commits), [commits]);
  const graphStyle = useMemo<GraphStyle | undefined>(
    () => colors && { commitSpacing: ROW_HEIGHT, branchSpacing: 12, nodeRadius: NODE_RADIUS, branchColors: colors },
    [colors],
  );
  const [graphWidth, setGraphWidth] = useState(0);
  useLayoutEffect(() => {
    setGraphWidth(Number(graphRef.current?.querySelector('svg')?.getAttribute('width') ?? 0));
  }, [graphCommits, graphStyle]);
  const tipLabel = branch === undefined ? undefined : branch.kind === 'branch' ? branch.name : 'detached';

  if (commits.length === 0) return <p className="git-explorer-message">No commits yet</p>;
  return (
    <>
      {/* Hidden, not unmounted, so the list keeps its scroll while a commit is open. */}
      <div className="history-tab" hidden={selected !== undefined}>
        <div
          className="history-graph-list"
          ref={listRef}
          style={{ '--history-graph-width': `${graphWidth}px`, '--history-graph-top': `${ROW_HEIGHT / 2 - 4 * NODE_RADIUS}px` } as CSSProperties}
        >
          <div className="history-graph" ref={graphRef} aria-hidden="true">
            {graphStyle !== undefined && <Graph commits={graphCommits} branchHeads={NO_BRANCH_HEADS} graphStyle={graphStyle} />}
          </div>
          <ul className="history-list" aria-label="Commits">
            {commits.map((commit, index) => (
              <li key={commit.hash}>
                <button type="button" className="history-commit" onClick={() => setSelected(commit)}>
                  <span className="history-commit-hash">{commit.shortHash}</span>
                  {index === 0 && tipLabel !== undefined && <span className="history-branch-label">{tipLabel}</span>}
                  <span className="history-commit-subject" title={firstLineOf(commit.message)}>
                    {firstLineOf(commit.message)}
                  </span>
                  <span className="history-commit-author" title={commit.author}>
                    {commit.author}
                  </span>
                  <span className="history-commit-date">{formatCommitDate(commit.date)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
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
