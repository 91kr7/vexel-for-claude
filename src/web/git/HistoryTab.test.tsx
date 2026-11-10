// @vitest-environment jsdom
// Component tests of HistoryTab and CommitDetail (plan-git_explorer, batch history).
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
  message: 'Add the history tab\n\nIt lists the commits.\nSecond body line.',
  author: 'Ada Lovelace',
  date: '2026-03-04T05:06:00+00:00',
};
const older: Commit = { hash: 'e5f6a7b8'.repeat(5), shortHash: 'e5f6a7b', message: 'first', author: 'Bob', date: '2025-12-31T23:59:00+01:00' };

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
const requestedUrl = (call: number) => new URL(String(fetchMock.mock.calls[call]?.[0]), 'http://localhost');

const tab = (props: Partial<React.ComponentProps<typeof HistoryTab>> = {}) => (
  <HistoryTab root={ROOT} commits={[newest, older]} hasMore={false} loadingMore={false} onLoadMore={() => {}} {...props} />
);

describe('HistoryTab', () => {
  // plan-git_explorer/REQ-16, REQ-17
  it('shows one row per commit, in order, with short hash, first line, author and local date', () => {
    const { container } = mount(tab());
    const list = commitList(container);
    expect(list, 'a list named "Commits"').not.toBeNull();
    const rows = [...list!.querySelectorAll('button')];
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain('a1b2c3d');
    expect(rows[0]!.textContent).toContain('Add the history tab');
    expect(rows[0]!.textContent).not.toContain('It lists the commits.');
    expect(rows[0]!.textContent).toContain(`Ada Lovelace · ${localDate(newest.date)}`);
    expect(rows[0]!.querySelector('[title="Add the history tab"]'), 'the first line as tooltip').not.toBeNull();
    expect(rows[1]!.textContent).toContain('e5f6a7b');
    expect(rows[1]!.textContent).toContain(`Bob · ${localDate(older.date)}`);
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

  // plan-git_explorer/REQ-18, REQ-22
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
    const rows = [...fileList(container)!.querySelectorAll('button')];
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

  // plan-git_explorer/REQ-19
  it('selects a clicked file and shows its diff in that commit', async () => {
    steps.push({ json: { files: [{ kind: 'modified', path: 'src/app.ts', binary: false }] } }, 'pending');
    const { container } = mount(detail());
    await until(() => fileList(container) !== null);
    const row = fileList(container)!.querySelector('button')!;
    flushSync(() => row.click());
    expect(row.getAttribute('aria-pressed')).toBe('true');
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

  // plan-git_explorer/REQ-22
  it('shows the binary note for a binary file', async () => {
    steps.push({ json: { files: [{ kind: 'added', path: 'logo.png', binary: true }] } }, { json: { binary: true, cut: false, lines: [] } });
    const { container } = mount(detail());
    await until(() => fileList(container) !== null);
    flushSync(() => fileList(container)!.querySelector('button')!.click());
    await until(() => container.textContent!.includes('Binary file, no diff shown'));
  });

  it('shows a git error of the diff as an alert', async () => {
    steps.push({ json: { files: [{ kind: 'modified', path: 'a.ts', binary: false }] } }, { json: { error: 'git_error', message: 'fatal: diff failed' }, status: 500 });
    const { container } = mount(detail());
    await until(() => fileList(container) !== null);
    flushSync(() => fileList(container)!.querySelector('button')!.click());
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
