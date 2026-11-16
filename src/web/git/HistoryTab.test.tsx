// @vitest-environment jsdom
// Component tests of HistoryTab and CommitDetail (plan-git_explorer batch history, plan-git_graph batch graph-history).
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommitDetail } from './CommitDetail';
import { HistoryTab } from './HistoryTab';
import type { Commit } from './history-store';

const ROOT = '/home/dev/project';
const newest: Commit = {
  hash: 'a1b2c3d4'.repeat(5),
  shortHash: 'a1b2c3d',
  parents: ['e5f6a7b8'.repeat(5)],
  message: 'Add the history tab\n\nIt lists the commits.\nSecond body line.',
  author: 'Ada Lovelace',
  date: '2026-03-04T05:06:00+00:00',
};
const older: Commit = { hash: 'e5f6a7b8'.repeat(5), shortHash: 'e5f6a7b', parents: [], message: 'first', author: 'Bob', date: '2025-12-31T23:59:00+01:00' };

/** DD/MM/YYYY HH:MM in local time, as the contract states. */
function localDate(iso: string): string {
  const d = new Date(iso);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

const roots: Root[] = [];
type Step = { json: unknown; status?: number } | 'pending';
let steps: Step[];
let fetchMock: ReturnType<typeof vi.fn>;
const pending: Array<(response: Response) => void> = [];

beforeEach(() => {
  steps = [];
  pending.length = 0;
  fetchMock = vi.fn(() => {
    const step = steps.shift() ?? 'pending';
    if (step === 'pending') return new Promise<Response>((resolve) => pending.push(resolve));
    return Promise.resolve(new Response(JSON.stringify(step.json), { status: step.status ?? 200 }));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

function mount(element: React.ReactElement): { container: HTMLElement; update: (next: React.ReactElement) => void } {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  flushSync(() => root.render(element));
  return { container, update: (next) => flushSync(() => root.render(next)) };
}

const until = (check: () => boolean) => vi.waitFor(() => expect(check()).toBe(true));
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
const buttonNamed = (scope: ParentNode, text: string) =>
  [...scope.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined;
const backButton = (scope: ParentNode) =>
  [...scope.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim().startsWith('Back')) as HTMLButtonElement | undefined;
const commitList = (scope: ParentNode) => scope.querySelector('[aria-label="Commits"]');
const fileList = (scope: ParentNode) => scope.querySelector('[aria-label="Changed files"]');
const fileOptions = (scope: ParentNode) => [...(fileList(scope)?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
const requestedUrl = (call: number) => new URL(String(fetchMock.mock.calls[call]?.[0]), 'http://localhost');

const tab = (props: Partial<React.ComponentProps<typeof HistoryTab>> = {}) => (
  <HistoryTab root={ROOT} commits={[newest, older]} hasMore={false} loadingMore={false} onLoadMore={() => {}} {...props} />
);

describe('HistoryTab', () => {
  // plan-git_explorer/REQ-16, REQ-17, plan-git_graph/REQ-13
  it('shows one row per commit, in order, with short hash, first line, author and local date', () => {
    const { container } = mount(tab());
    const list = commitList(container);
    expect(list, 'a list named "Commits"').not.toBeNull();
    const rows = [...list!.querySelectorAll('button')];
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain('a1b2c3d');
    expect(rows[0]!.textContent).toContain('Add the history tab');
    expect(rows[0]!.textContent).not.toContain('It lists the commits.');
    expect(rows[0]!.textContent).toContain('Ada Lovelace');
    expect(rows[0]!.textContent).toContain(localDate(newest.date));
    expect(rows[0]!.querySelector('[title="Add the history tab"]'), 'the first line as tooltip').not.toBeNull();
    expect(rows[0]!.querySelector('[title="Ada Lovelace"]'), 'the author as tooltip').not.toBeNull();
    expect(rows[1]!.textContent).toContain('e5f6a7b');
    expect(rows[1]!.textContent).toContain('Bob');
    expect(rows[1]!.textContent).toContain(localDate(older.date));
  });

  // plan-git_explorer/REQ-20
  it('says "No commits yet" and shows no error for no commits', () => {
    const { container } = mount(tab({ commits: [] }));
    expect(container.textContent).toContain('No commits yet');
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  // plan-git_explorer/REQ-21
  it('shows "Load more" only with more commits, and calls onLoadMore', () => {
    const onLoadMore = vi.fn();
    const { container, update } = mount(tab({ onLoadMore }));
    expect(buttonNamed(container, 'Load more')).toBeUndefined();
    update(tab({ hasMore: true, onLoadMore }));
    flushSync(() => buttonNamed(container, 'Load more')!.click());
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('reads "Loading…" and is disabled while the next page loads', () => {
    const { container } = mount(tab({ hasMore: true, loadingMore: true }));
    expect(buttonNamed(container, 'Load more')).toBeUndefined();
    const button = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Loading…'));
    expect(button).toBeDefined();
    expect(button!.disabled).toBe(true);
  });

  it('shows moreError in an alert above "Load more"', () => {
    const { container } = mount(tab({ hasMore: true, moreError: 'fatal: broken' }));
    const alert = container.querySelector('[role="alert"]');
    expect(alert!.textContent).toBe('fatal: broken');
    const load = buttonNamed(container, 'Load more')!;
    expect(alert!.compareDocumentPosition(load) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // plan-git_explorer/REQ-18
  it('opens the commit detail on a click, and "Back" brings the list again', async () => {
    const { container } = mount(tab());
    flushSync(() => commitList(container)!.querySelectorAll('button')[0]!.click());
    await until(() => backButton(container) !== undefined);
    const list = commitList(container);
    expect(list === null || list.closest('[hidden]') !== null, 'the detail replaces the list').toBe(true);
    expect(requestedUrl(0).searchParams.get('hash')).toBe(newest.hash);
    flushSync(() => backButton(container)!.click());
    expect(backButton(container)).toBeUndefined();
    expect(commitList(container)).not.toBeNull();
  });
});

const detail = (onBack = () => {}) => <CommitDetail root={ROOT} commit={newest} onBack={onBack} />;

describe('CommitDetail', () => {
  // plan-git_explorer/REQ-17, REQ-18
  it('shows the short hash with the full hash as tooltip, the full message and the author line', () => {
    const { container } = mount(detail());
    const chip = container.querySelector(`[title="${newest.hash}"]`);
    expect(chip!.textContent).toBe('a1b2c3d');
    expect(container.textContent).toContain('It lists the commits.');
    const message = [...container.querySelectorAll('*')].find((el) => el.textContent === newest.message);
    expect(message, 'the full message, line breaks kept').toBeDefined();
    expect(container.textContent).toContain(`Ada Lovelace · ${localDate(newest.date)}`);
  });

  it('shows "Loading…" while the files load', () => {
    const { container } = mount(detail());
    expect(container.querySelector('[role="status"]')!.textContent).toBe('Loading…');
  });

  // plan-git_explorer/REQ-18, REQ-22, plan-git_graph/REQ-14, REQ-16
  it('lists the files with their kind label, a rename as old → new, and "Binary"', async () => {
    steps.push({
      json: {
        files: [
          { kind: 'added', path: 'src/new.ts', binary: false },
          { kind: 'modified', path: 'src/app.ts', binary: false },
          { kind: 'deleted', path: 'old.txt', binary: false },
          { kind: 'renamed', path: 'b.md', oldPath: 'a.md', binary: false },
          { kind: 'added', path: 'logo.png', binary: true },
        ],
      },
    });
    const { container } = mount(detail());
    await until(() => fileList(container) !== null);
    expect(fileList(container)!.getAttribute('role')).toBe('listbox');
    const rows = fileOptions(container);
    expect(rows).toHaveLength(5);
    expect(rows[0]!.textContent).toContain('src/new.ts');
    expect(rows[0]!.textContent).toContain('Added');
    expect(rows[1]!.textContent).toContain('Modified');
    expect(rows[2]!.textContent).toContain('Deleted');
    expect(rows[3]!.textContent).toContain('a.md → b.md');
    expect(rows[3]!.textContent).toContain('Renamed');
    expect(rows[4]!.textContent).toContain('logo.png');
    expect(rows[4]!.textContent).toContain('Binary');
    expect(rows[1]!.textContent).not.toContain('Binary');
    const hasPathTooltip = rows[0]!.title === 'src/new.ts' || rows[0]!.querySelector('[title="src/new.ts"]') !== null;
    expect(hasPathTooltip, 'the path as tooltip').toBe(true);
    const url = requestedUrl(0);
    expect(url.pathname).toBe('/api/git/commit-files');
    expect(url.searchParams.get('path')).toBe(ROOT);
    expect(url.searchParams.get('hash')).toBe(newest.hash);
  });

  it('says "No files changed" for a commit with no files', async () => {
    steps.push({ json: { files: [] } });
    const { container } = mount(detail());
    await until(() => container.textContent!.includes('No files changed'));
  });

  // plan-git_explorer/REQ-6
  it('shows a git error of the files as an alert', async () => {
    steps.push({ json: { error: 'git_error', message: 'fatal: bad object' }, status: 500 });
    const { container } = mount(detail());
    await until(() => container.querySelector('[role="alert"]') !== null);
    expect(container.querySelector('[role="alert"]')!.textContent).toBe('fatal: bad object');
  });

  // plan-git_explorer/REQ-19, plan-git_graph/REQ-15
  it('selects a clicked file and shows its diff in that commit', async () => {
    steps.push({ json: { files: [{ kind: 'modified', path: 'src/app.ts', binary: false }] } }, 'pending');
    const { container } = mount(detail());
    await until(() => fileList(container) !== null);
    const row = fileOptions(container)[0]!;
    flushSync(() => row.click());
    expect(row.getAttribute('aria-selected')).toBe('true');
    await until(() => fetchMock.mock.calls.length === 2);
    const url = requestedUrl(1);
    expect(url.pathname).toBe('/api/git/commit-diff');
    expect(url.searchParams.get('hash')).toBe(newest.hash);
    expect(url.searchParams.get('file')).toBe('src/app.ts');
    await until(() => container.querySelector('[role="status"]')?.textContent === 'Loading…');
    pending[0]!(new Response(JSON.stringify({ binary: false, cut: false, lines: [{ kind: 'removed', text: 'old line' }, { kind: 'added', text: 'new line' }] })));
    await until(() => container.textContent!.includes('new line'));
    expect(container.textContent).toContain('old line');
  });

  it('keeps the selected file selected after a second click on it, and moves the selection to another file', async () => {
    steps.push({ json: { files: [{ kind: 'modified', path: 'a.ts', binary: false }, { kind: 'added', path: 'b.ts', binary: false }] } });
    const { container } = mount(detail());
    await until(() => fileList(container) !== null);
    const [first, second] = fileOptions(container);
    flushSync(() => first!.click());
    flushSync(() => first!.click());
    expect(first!.getAttribute('aria-selected')).toBe('true');
    flushSync(() => second!.click());
    expect(first!.getAttribute('aria-selected')).toBe('false');
    expect(second!.getAttribute('aria-selected')).toBe('true');
    await settle();
  });

  // plan-git_explorer/REQ-22, plan-git_graph/REQ-16
  it('shows the binary note for a binary file', async () => {
    steps.push({ json: { files: [{ kind: 'added', path: 'logo.png', binary: true }] } }, { json: { binary: true, cut: false, lines: [] } });
    const { container } = mount(detail());
    await until(() => fileList(container) !== null);
    flushSync(() => fileOptions(container)[0]!.click());
    await until(() => container.textContent!.includes('Binary file, no diff shown'));
  });

  it('shows a git error of the diff as an alert', async () => {
    steps.push({ json: { files: [{ kind: 'modified', path: 'a.ts', binary: false }] } }, { json: { error: 'git_error', message: 'fatal: diff failed' }, status: 500 });
    const { container } = mount(detail());
    await until(() => fileList(container) !== null);
    flushSync(() => fileOptions(container)[0]!.click());
    await until(() => container.querySelector('[role="alert"]')?.textContent === 'fatal: diff failed');
  });

  it('calls onBack on "Back"', async () => {
    const onBack = vi.fn();
    const { container } = mount(detail(onBack));
    flushSync(() => backButton(container)!.click());
    expect(onBack).toHaveBeenCalledTimes(1);
    await settle();
  });
});

describe('HistoryTab after a refresh', () => {
  const listShown = (container: HTMLElement) => {
    const list = commitList(container);
    return list !== null && list.closest('[hidden]') === null;
  };

  // plan-git_explorer/REQ-26
  it('keeps the open commit open, as it was, when its hash is still among the commits', async () => {
    const { container, update } = mount(tab());
    flushSync(() => commitList(container)!.querySelectorAll('button')[1]!.click());
    await until(() => backButton(container) !== undefined);
    const calls = fetchMock.mock.calls.length;
    const added: Commit = { hash: 'f'.repeat(40), shortHash: 'fffffff', message: 'newer', author: 'Cy', date: '2026-11-10T10:00:00+00:00' };
    update(tab({ commits: [added, { ...newest }, { ...older }] }));
    expect(backButton(container)).toBeDefined();
    expect(listShown(container)).toBe(false);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(calls);
  });

  it('closes the open commit and shows the list when its hash is no longer among the commits', async () => {
    const { container, update } = mount(tab());
    flushSync(() => commitList(container)!.querySelectorAll('button')[1]!.click());
    await until(() => backButton(container) !== undefined);
    update(tab({ commits: [{ ...newest }] }));
    expect(backButton(container)).toBeUndefined();
    expect(listShown(container)).toBe(true);
  });
});

// The graph is an SVG in the part of the tab hidden from assistive technology. Nodes are read as circle centres
// in row order; lines as straight segments and curves, each with its two ends.
type Point = { x: number; y: number };
type Segment = { from: Point; to: Point };
const ROW = 28;
const TOLERANCE = 6;
const graph = (scope: ParentNode) => scope.querySelector('[aria-hidden="true"] svg');
const num = (el: Element, name: string) => Number(el.getAttribute(name));

function nodes(scope: ParentNode): Point[] {
  const seen = new Map<string, Point>();
  for (const circle of graph(scope)?.querySelectorAll('circle') ?? []) {
    const point = { x: num(circle, 'cx'), y: num(circle, 'cy') };
    seen.set(`${point.x},${point.y}`, point);
  }
  return [...seen.values()].sort((a, b) => a.y - b.y);
}

function segments(scope: ParentNode): { lines: Segment[]; curves: Segment[] } {
  const svg = graph(scope);
  const lines = [...(svg?.querySelectorAll('line') ?? [])].map((line) => ({
    from: { x: num(line, 'x1'), y: num(line, 'y1') },
    to: { x: num(line, 'x2'), y: num(line, 'y2') },
  }));
  const curves = [...(svg?.querySelectorAll('path') ?? [])].map((path) => {
    const values = (path.getAttribute('d') ?? '').match(/-?\d+(\.\d+)?/g)!.map(Number);
    return { from: { x: values[0]!, y: values[1]! }, to: { x: values.at(-2)!, y: values.at(-1)! } };
  });
  return { lines, curves };
}

const near = (a: Point, b: Point) => Math.abs(a.x - b.x) <= TOLERANCE && Math.abs(a.y - b.y) <= TOLERANCE;

/** A line or curve joins the two nodes: its ends sit on them, or a vertical line runs through both. */
function joined(scope: ParentNode, a: Point, b: Point): boolean {
  const { lines, curves } = segments(scope);
  const ends = [...lines, ...curves].some((s) => (near(s.from, a) && near(s.to, b)) || (near(s.from, b) && near(s.to, a)));
  const through = lines.some((s) => {
    const sameLane = [s.from.x, s.to.x, b.x].every((x) => Math.abs(x - a.x) <= 2);
    const top = Math.min(s.from.y, s.to.y);
    const bottom = Math.max(s.from.y, s.to.y);
    return sameLane && top <= Math.min(a.y, b.y) + TOLERANCE && bottom >= Math.max(a.y, b.y) - TOLERANCE;
  });
  return ends || through;
}

/** Vertical lines of the lane at x cover the whole span from y1 to y2, with no gap. */
function laneCovers(scope: ParentNode, x: number, y1: number, y2: number): boolean {
  const spans = segments(scope)
    .lines.filter((s) => Math.abs(s.from.x - x) <= 2 && Math.abs(s.to.x - x) <= 2)
    .map((s) => [Math.min(s.from.y, s.to.y), Math.max(s.from.y, s.to.y)] as const)
    .sort((a, b) => a[0] - b[0]);
  let reached = y1;
  for (const [top, bottom] of spans) if (top <= reached + TOLERANCE) reached = Math.max(reached, bottom);
  return reached >= y2 - TOLERANCE;
}

const hash = (char: string) => char.repeat(40);
const commitOf = (char: string, parents: string[] | undefined, day: number): Commit => ({
  hash: hash(char),
  shortHash: char.repeat(7),
  ...(parents === undefined ? {} : { parents: parents.map(hash) }),
  message: `commit ${char}`,
  author: 'Ada',
  date: `2026-01-${String(day).padStart(2, '0')}T10:00:00Z`,
});
const rowsOf = (scope: ParentNode) => [...(commitList(scope)?.querySelectorAll('button') ?? [])];

describe('HistoryTab graph', () => {
  // plan-git_graph/REQ-8, REQ-10: the merge m has parents a (first) and f (second)
  it('draws a line from a merge to each of its parents, the second parent in a lane to the right', () => {
    const { container } = mount(tab({ commits: [commitOf('m', ['a', 'f'], 4), commitOf('f', ['a'], 3), commitOf('a', [], 2)] }));
    expect(graph(container), 'a graph hidden from assistive technology').not.toBeNull();
    expect(rowsOf(container)).toHaveLength(3);
    const [m, f, a] = nodes(container);
    expect(m!.y < f!.y && f!.y < a!.y, 'one node per row, in list order').toBe(true);
    expect(f!.y - m!.y).toBe(ROW);
    expect(f!.x).toBeGreaterThan(m!.x);
    expect(joined(container, m!, a!), 'merge → first parent').toBe(true);
    expect(joined(container, m!, f!), 'merge → second parent').toBe(true);
    expect(joined(container, f!, a!), 'feature commit → its parent').toBe(true);
  });

  // plan-git_graph/REQ-11
  it('draws a history with no merges as one straight line in one lane', () => {
    const { container } = mount(tab({ commits: [commitOf('d', ['c'], 4), commitOf('c', ['b'], 3), commitOf('b', ['a'], 2), commitOf('a', [], 1)] }));
    const points = nodes(container);
    expect(points).toHaveLength(4);
    expect(new Set(points.map((p) => p.x)).size, 'a single lane').toBe(1);
    expect(segments(container).curves, 'no curves').toHaveLength(0);
    expect(laneCovers(container, points[0]!.x, points[0]!.y, points[3]!.y), 'no gap between the nodes').toBe(true);
  });

  it('counts a commit with no parents field as a root', () => {
    const { container } = mount(tab({ commits: [commitOf('b', undefined, 2), commitOf('a', undefined, 1)] }));
    const points = nodes(container);
    expect(points).toHaveLength(2);
    expect(joined(container, points[0]!, points[1]!)).toBe(false);
  });

  // plan-git_graph/REQ-10, REQ-19: the second parent x is not loaded yet
  it('runs the line to a parent not loaded yet past the last row, and makes no row for it', () => {
    const { container } = mount(tab({ commits: [commitOf('m', ['a', 'x'], 2), commitOf('a', [], 1)], hasMore: true }));
    expect(rowsOf(container)).toHaveLength(2);
    const [m, a] = nodes(container);
    const { lines, curves } = segments(container);
    const otherLane = [...lines, ...curves].filter((s) => Math.abs(s.from.x - m!.x) > 2 || Math.abs(s.to.x - m!.x) > 2);
    expect(Math.max(...otherLane.map((s) => Math.max(s.from.y, s.to.y))), 'the second-parent line reaches the bottom edge').toBeGreaterThanOrEqual(a!.y + ROW / 2);
  });

  // plan-git_graph/REQ-19
  it('joins the lines across the page border after "Load more", with no gap', () => {
    const first = [commitOf('d', ['c'], 4), commitOf('c', ['b'], 3)];
    const { container, update } = mount(tab({ commits: first, hasMore: true }));
    const before = nodes(container);
    expect(laneCovers(container, before[0]!.x, before[0]!.y, before[1]!.y + ROW / 2), 'the line to the unloaded parent runs past the last row').toBe(true);
    update(tab({ commits: [...first, commitOf('b', ['a'], 2), commitOf('a', [], 1)], hasMore: false }));
    expect(rowsOf(container)).toHaveLength(4);
    const after = nodes(container);
    expect(after, 'no placeholder left once every parent is loaded').toHaveLength(4);
    expect(new Set(after.map((p) => p.x)).size).toBe(1);
    expect(segments(container).curves).toHaveLength(0);
    expect(laneCovers(container, after[0]!.x, after[0]!.y, after[3]!.y)).toBe(true);
  });
});

describe('HistoryTab branch label', () => {
  const labelled = (row: Element, text: string) => [...row.querySelectorAll('*')].some((el) => el.textContent === text);

  // plan-git_graph/REQ-12
  it('labels only the first commit with the branch name', () => {
    const { container } = mount(tab({ branch: { kind: 'branch', name: 'main' } }));
    const rows = rowsOf(container);
    expect(labelled(rows[0]!, 'main')).toBe(true);
    expect(labelled(rows[1]!, 'main')).toBe(false);
  });

  it('labels the first commit "detached" on a detached HEAD', () => {
    const { container } = mount(tab({ branch: { kind: 'detached', hash: newest.hash } }));
    const rows = rowsOf(container);
    expect(labelled(rows[0]!, 'detached')).toBe(true);
    expect(labelled(rows[1]!, 'detached')).toBe(false);
  });

  it('shows no label without a branch', () => {
    const { container } = mount(tab());
    for (const row of rowsOf(container)) expect(labelled(row, 'main') || labelled(row, 'detached')).toBe(false);
  });
});
