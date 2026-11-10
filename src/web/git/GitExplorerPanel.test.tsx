// @vitest-environment jsdom
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitExplorerPanel } from './GitExplorerPanel';
import type { RepositoryLookupState } from './repository-lookup-store';

const roots: Root[] = [];
let pending: Array<(response: Response) => void>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  pending = [];
  fetchMock = vi.fn(() => new Promise<Response>((resolve) => pending.push(resolve)));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

function render(lookup: RepositoryLookupState): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  flushSync(() => root.render(<GitExplorerPanel lookup={lookup} />));
  const region = container.querySelector('section[aria-label="Git Explorer"]');
  expect(region, 'a section named "Git Explorer"').not.toBeNull();
  return region as HTMLElement;
}

describe('GitExplorerPanel', () => {
  // plan-git_explorer/REQ-4: repository folder name, full path on hover, branch
  it('shows the root folder name with the full root as tooltip, and the branch', () => {
    const region = render({ status: 'repository', root: '/home/dev/my-project', branch: { kind: 'branch', name: 'main' } });
    const name = region.querySelector('[title="/home/dev/my-project"]');
    expect(name, 'an element with the root path as tooltip').not.toBeNull();
    expect(name!.textContent).toBe('my-project');
    expect(region.textContent).toContain('main');
    expect(region.querySelector('[role="alert"]')).toBeNull();
  });

  // plan-git_explorer/REQ-4: detached HEAD
  it('shows "detached" and the short hash on a detached HEAD', () => {
    const region = render({ status: 'repository', root: '/home/dev/my-project', branch: { kind: 'detached', hash: 'a1b2c3d' } });
    expect(region.textContent).toContain('detached a1b2c3d');
  });

  // plan-git_explorer/REQ-6
  it('shows a git error as an alert with its message', () => {
    const alert = render({ status: 'error', message: 'fatal: bad object HEAD' }).querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert!.textContent).toBe('fatal: bad object HEAD');
  });

  it.each<[string, RepositoryLookupState]>([
    ['loading', { status: 'loading' }],
    ['none', { status: 'none' }],
  ])('is an empty region while the lookup is %s', (_name, lookup) => {
    expect(render(lookup).textContent).toBe('');
  });
});

const repository: RepositoryLookupState = { status: 'repository', root: '/home/dev/my-project', branch: { kind: 'branch', name: 'main' } };
const until = (check: () => boolean) => vi.waitFor(() => expect(check()).toBe(true));
const answer = (body: unknown, status = 200) => pending[0]!(new Response(JSON.stringify(body), { status }));

describe('GitExplorerPanel changes', () => {
  // plan-git_explorer/REQ-9: read once, for the repository root
  it('asks the changes of the repository root once and shows "Loading…" meanwhile', async () => {
    const region = render(repository);
    await until(() => fetchMock.mock.calls.length === 1);
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]), 'http://localhost');
    expect(url.pathname).toBe('/api/git/changes');
    expect(url.searchParams.get('path')).toBe('/home/dev/my-project');
    await until(() => region.textContent!.includes('Loading…'));
  });

  // plan-git_explorer/REQ-13
  it('says "No uncommitted changes" for a clean repository', async () => {
    const region = render(repository);
    await until(() => pending.length === 1);
    answer({ changes: [] });
    await until(() => region.textContent!.includes('No uncommitted changes'));
    expect(region.querySelector('section[aria-label="Staged"], section[aria-label="Unstaged"]')).toBeNull();
  });

  it('shows the changes in the groups of the changes tab', async () => {
    const region = render(repository);
    await until(() => pending.length === 1);
    answer({ changes: [{ group: 'unstaged', kind: 'untracked', path: 'notes.txt' }] });
    await until(() => region.querySelector('section[aria-label="Unstaged"]') !== null);
    expect(region.querySelector('section[aria-label="Unstaged"]')!.textContent).toContain('notes.txt');
    expect(region.textContent).not.toContain('No uncommitted changes');
  });

  // plan-git_explorer/REQ-6
  it('shows a git error of the changes as an alert with its message', async () => {
    const region = render(repository);
    await until(() => pending.length === 1);
    answer({ error: 'git_error', message: 'fatal: index file corrupt' }, 500);
    await until(() => region.querySelector('[role="alert"]') !== null);
    expect(region.querySelector('[role="alert"]')!.textContent).toBe('fatal: index file corrupt');
  });

  it.each<[string, RepositoryLookupState]>([
    ['loading', { status: 'loading' }],
    ['none', { status: 'none' }],
    ['error', { status: 'error', message: 'fatal: x' }],
  ])('asks no changes while the lookup is %s', async (_name, lookup) => {
    render(lookup);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

const tabs = (region: HTMLElement) => [...region.querySelectorAll('[role="tab"]')] as HTMLElement[];
const tabNamed = (region: HTMLElement, name: string) => tabs(region).find((t) => t.textContent?.trim() === name)!;
const isHidden = (element: Element) => element.closest('[hidden]') !== null;
const paths = () => fetchMock.mock.calls.map((call) => new URL(String(call[0]), 'http://localhost').pathname);
/** Answers the first pending request to `pathname`. */
function answerTo(pathname: string, body: unknown, status = 200) {
  const index = paths().indexOf(pathname);
  pending[index]!(new Response(JSON.stringify(body), { status }));
}
const historyCommit = { hash: 'a'.repeat(40), shortHash: 'aaaaaaa', message: 'Initial import', author: 'Ada', date: '2026-11-10T15:25:02+01:00' };

describe('GitExplorerPanel tabs', () => {
  // plan-git_explorer/REQ-16 (spec GitExplorerPanel): tabs "Changes" (selected) and "History"
  it('shows the tabs "Changes", selected, and "History"; the history is not read before its tab opens', async () => {
    const region = render(repository);
    expect(tabs(region).map((t) => t.textContent?.trim())).toEqual(['Changes', 'History']);
    expect(tabNamed(region, 'Changes').getAttribute('aria-selected')).toBe('true');
    expect(tabNamed(region, 'History').getAttribute('aria-selected')).toBe('false');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(paths()).toEqual(['/api/git/changes']);
  });

  // plan-git_explorer/REQ-16
  it('reads the first history page of the root when "History" first opens, and shows it', async () => {
    const region = render(repository);
    flushSync(() => tabNamed(region, 'History').click());
    expect(tabNamed(region, 'History').getAttribute('aria-selected')).toBe('true');
    expect(tabNamed(region, 'Changes').getAttribute('aria-selected')).toBe('false');
    await until(() => paths().includes('/api/git/history'));
    const url = new URL(String(fetchMock.mock.calls[paths().indexOf('/api/git/history')]?.[0]), 'http://localhost');
    expect(url.searchParams.get('path')).toBe('/home/dev/my-project');
    expect(url.searchParams.get('offset')).toBe('0');
    const historyPanel = () => [...region.querySelectorAll('[role="tabpanel"]')].find((p) => !isHidden(p))!;
    await until(() => historyPanel().textContent!.includes('Loading…'));
    answerTo('/api/git/history', { commits: [historyCommit], hasMore: false });
    await until(() => historyPanel().textContent!.includes('Initial import'));
  });

  // plan-git_explorer/REQ-20
  it('says "No commits yet" in "History" for a repository with no commits', async () => {
    const region = render(repository);
    flushSync(() => tabNamed(region, 'History').click());
    await until(() => paths().includes('/api/git/history'));
    answerTo('/api/git/history', { commits: [], hasMore: false });
    await until(() => region.textContent!.includes('No commits yet'));
    expect(region.querySelector('[role="alert"]')).toBeNull();
  });

  it('keeps both panels mounted, hides the other one, and reads nothing again when going back to a tab', async () => {
    const region = render(repository);
    await until(() => pending.length === 1);
    answerTo('/api/git/changes', { changes: [] });
    await until(() => region.textContent!.includes('No uncommitted changes'));
    flushSync(() => tabNamed(region, 'History').click());
    await until(() => paths().includes('/api/git/history'));
    answerTo('/api/git/history', { commits: [historyCommit], hasMore: false });
    await until(() => region.textContent!.includes('Initial import'));
    const changesText = [...region.querySelectorAll('*')].find((el) => el.textContent === 'No uncommitted changes')!;
    expect(isHidden(changesText), 'the Changes panel is hidden, not removed').toBe(true);

    flushSync(() => tabNamed(region, 'Changes').click());
    flushSync(() => tabNamed(region, 'History').click());
    flushSync(() => tabNamed(region, 'Changes').click());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(paths()).toEqual(['/api/git/changes', '/api/git/history']);
    expect(isHidden(changesText)).toBe(false);
  });

  // plan-git_explorer/REQ-6
  it('shows a git error of the history as an alert in the panel', async () => {
    const region = render(repository);
    flushSync(() => tabNamed(region, 'History').click());
    await until(() => paths().includes('/api/git/history'));
    answerTo('/api/git/history', { error: 'git_error', message: 'fatal: bad object HEAD' }, 500);
    await until(() => region.querySelector('[role="alert"]') !== null);
    expect(region.querySelector('[role="alert"]')!.textContent).toBe('fatal: bad object HEAD');
  });
});
