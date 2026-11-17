// @vitest-environment jsdom
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitExplorerPanel } from './GitExplorerPanel';
import { ExitPresence } from '../motion/ExitPresence';
import type { SessionSummary } from '../sessions/live-session-store';
import type { CoveredRepository, RepositoryLookupState } from './repository-lookup-store';

const one = (entry: CoveredRepository): RepositoryLookupState => ({ status: 'repositories', repositories: [entry] });
const myProject = (branch: { kind: 'branch'; name: string } | { kind: 'detached'; hash: string }): CoveredRepository => ({
  root: '/home/dev/my-project',
  name: 'my-project',
  path: '.',
  branch,
});

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
    const region = render(one(myProject({ kind: 'branch', name: 'main' })));
    const name = region.querySelector('[title="/home/dev/my-project"]');
    expect(name, 'an element with the root path as tooltip').not.toBeNull();
    expect(name!.textContent).toBe('my-project');
    expect(region.textContent).toContain('main');
    expect(region.querySelector('[role="alert"]')).toBeNull();
  });

  // plan-git_explorer/REQ-4: detached HEAD
  it('shows "detached" and the short hash on a detached HEAD', () => {
    const region = render(one(myProject({ kind: 'detached', hash: 'a1b2c3d' })));
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

const repository: RepositoryLookupState = one(myProject({ kind: 'branch', name: 'main' }));
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

const ROOT_PATH = '/home/dev/my-project';
const summary = (id: string, folder: string, state: SessionSummary['state']): SessionSummary => ({
  id,
  folder,
  label: id,
  state,
  lastActivity: '2026-11-10T10:00:00Z',
});

function renderWith(props: React.ComponentProps<typeof GitExplorerPanel>) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  flushSync(() => root.render(<GitExplorerPanel {...props} />));
  const region = () => container.querySelector<HTMLElement>('section[aria-label="Git Explorer"]')!;
  return {
    region,
    update: (next: React.ComponentProps<typeof GitExplorerPanel>) => flushSync(() => root.render(<GitExplorerPanel {...next} />)),
    unmount: () => {
      root.unmount();
      roots.splice(roots.indexOf(root), 1);
    },
  };
}

const refreshButton = (region: HTMLElement) =>
  [...region.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Refresh' || b.textContent?.trim() === 'Refresh');
const callsTo = (pathname: string) => paths().filter((p) => p === pathname).length;
/** Answers the last request to `pathname`. */
function answerLast(pathname: string, body: unknown, status = 200) {
  const index = paths().lastIndexOf(pathname);
  pending[index]!(new Response(JSON.stringify(body), { status }));
}
const changeEntry = (path: string) => ({ group: 'unstaged', kind: 'modified', path });
const settlePanel = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('GitExplorerPanel refresh', () => {
  // plan-git_explorer/REQ-24
  it('shows the icon button "Refresh" with its tooltip in the header', () => {
    const { region } = renderWith({ lookup: repository });
    const button = refreshButton(region());
    expect(button, 'a "Refresh" button').toBeDefined();
    expect(button!.getAttribute('title')).toBe('Refresh');
    expect(button!.querySelector('svg'), 'an icon').not.toBeNull();
  });

  // plan-git_explorer/REQ-24
  it('reads the changes again and calls onRefresh on "Refresh"; the unopened history is not read', async () => {
    const onRefresh = vi.fn();
    const { region } = renderWith({ lookup: repository, onRefresh });
    await until(() => callsTo('/api/git/changes') === 1);
    answerLast('/api/git/changes', { changes: [changeEntry('a.ts')] });
    await until(() => region().textContent!.includes('a.ts'));
    flushSync(() => refreshButton(region())!.click());
    expect(onRefresh).toHaveBeenCalledTimes(1);
    await until(() => callsTo('/api/git/changes') === 2);
    const url = new URL(String(fetchMock.mock.calls[paths().lastIndexOf('/api/git/changes')]?.[0]), 'http://localhost');
    expect(url.searchParams.get('path')).toBe(ROOT_PATH);
    await settlePanel();
    expect(callsTo('/api/git/history')).toBe(0);
  });

  it('keeps the changes shown until the refresh answers, then shows the new ones', async () => {
    const { region } = renderWith({ lookup: repository });
    await until(() => callsTo('/api/git/changes') === 1);
    answerLast('/api/git/changes', { changes: [changeEntry('old-file.ts')] });
    await until(() => region().textContent!.includes('old-file.ts'));
    flushSync(() => refreshButton(region())!.click());
    await until(() => callsTo('/api/git/changes') === 2);
    await settlePanel();
    expect(region().textContent).toContain('old-file.ts');
    expect(region().textContent).not.toContain('Loading…');
    answerLast('/api/git/changes', { changes: [changeEntry('new-file.ts')] });
    await until(() => region().textContent!.includes('new-file.ts'));
    expect(region().textContent).not.toContain('old-file.ts');
  });

  // plan-git_explorer/REQ-24
  it('reads the first history page again once the tab was opened, with "Load more" disabled meanwhile', async () => {
    const { region } = renderWith({ lookup: repository });
    flushSync(() => tabNamed(region(), 'History').click());
    await until(() => callsTo('/api/git/history') === 1);
    answerLast('/api/git/history', { commits: [historyCommit], hasMore: true });
    await until(() => region().textContent!.includes('Initial import'));
    flushSync(() => refreshButton(region())!.click());
    await until(() => callsTo('/api/git/history') === 2);
    const url = new URL(String(fetchMock.mock.calls[paths().lastIndexOf('/api/git/history')]?.[0]), 'http://localhost');
    expect(url.searchParams.get('offset')).toBe('0');
    const loadMore = () => [...region().querySelectorAll('button')].find((b) => /Load more|Loading…/.test(b.textContent ?? '')) as HTMLButtonElement;
    await until(() => loadMore()?.textContent?.trim() === 'Loading…');
    expect(loadMore().disabled).toBe(true);
    expect(region().textContent).toContain('Initial import');
  });

  // plan-git_explorer/REQ-24, plan-git_explorer/REQ-6
  it('shows only "Refresh" in the header with a git error, and calls onRefresh on it', () => {
    const onRefresh = vi.fn();
    const { region } = renderWith({ lookup: { status: 'error', message: 'fatal: x' }, onRefresh });
    expect(region().querySelectorAll('button')).toHaveLength(1);
    expect(region().querySelector('[role="alert"]')!.textContent).toBe('fatal: x');
    flushSync(() => refreshButton(region())!.click());
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  // plan-git_explorer/REQ-23
  it('reads the changes again at each mount, with nothing kept from the previous opening', async () => {
    const first = renderWith({ lookup: repository });
    await until(() => callsTo('/api/git/changes') === 1);
    answerLast('/api/git/changes', { changes: [changeEntry('old-file.ts')] });
    await until(() => first.region().textContent!.includes('old-file.ts'));
    first.unmount();
    const second = renderWith({ lookup: repository });
    expect(second.region().textContent).not.toContain('old-file.ts');
    await until(() => callsTo('/api/git/changes') === 2);
  });
});

describe('GitExplorerPanel turn-end refresh', () => {
  // plan-git_explorer/REQ-25
  it('refreshes with no click when a session in the repository goes from working to idle', async () => {
    const onRefresh = vi.fn();
    const props = { lookup: repository, onRefresh };
    const { update } = renderWith({ ...props, sessions: [summary('b', `${ROOT_PATH}/frontend`, 'working')] });
    await until(() => callsTo('/api/git/changes') === 1);
    update({ ...props, sessions: [summary('b', `${ROOT_PATH}/frontend`, 'idle')] });
    await until(() => callsTo('/api/git/changes') === 2);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not refresh for a turn end outside the repository', async () => {
    const onRefresh = vi.fn();
    const props = { lookup: repository, onRefresh };
    const { update } = renderWith({ ...props, sessions: [summary('b', '/home/dev/other', 'working')] });
    await until(() => callsTo('/api/git/changes') === 1);
    update({ ...props, sessions: [summary('b', '/home/dev/other', 'idle')] });
    await settlePanel();
    expect(callsTo('/api/git/changes')).toBe(1);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('does not refresh when the first session list already holds an idle session', async () => {
    const onRefresh = vi.fn();
    renderWith({ lookup: repository, onRefresh, sessions: [summary('b', ROOT_PATH, 'idle')] });
    await settlePanel();
    expect(callsTo('/api/git/changes')).toBe(1);
    expect(onRefresh).not.toHaveBeenCalled();
  });
});

const WS = '/home/dev/ws';
const several: RepositoryLookupState = {
  status: 'repositories',
  repositories: [
    { root: `${WS}/api`, name: 'api', path: 'api', branch: { kind: 'branch', name: 'main' } },
    { root: `${WS}/web/app`, name: 'app', path: 'web/app', branch: { kind: 'detached', hash: 'a1b2c3d' } },
  ],
};
const repositoryList = (region: HTMLElement) => region.querySelector('[aria-label="Repositories"]');
const pathsOf = (pathname: string) =>
  fetchMock.mock.calls
    .map((call) => new URL(String(call[0]), 'http://localhost'))
    .filter((url) => url.pathname === pathname)
    .map((url) => url.searchParams.get('path'));
/** Answers the request for the changes of `root`. */
function answerChangesOf(root: string, body: unknown, status = 200) {
  const index = fetchMock.mock.calls.findIndex((call) => {
    const url = new URL(String(call[0]), 'http://localhost');
    return url.pathname === '/api/git/changes' && url.searchParams.get('path') === root;
  });
  pending[index]!(new Response(JSON.stringify(body), { status }));
}

describe('GitExplorerPanel with one or several repositories', () => {
  // plan-multi_repo_workspace/REQ-13
  it('shows one repository as before: name, branch chip and "Refresh", with no repository list', () => {
    const { region } = renderWith({ lookup: repository });
    expect(repositoryList(region())).toBeNull();
    expect(region().querySelector('[title="/home/dev/my-project"]')!.textContent).toBe('my-project');
    expect(region().textContent).toContain('main');
    expect(refreshButton(region())).toBeDefined();
    expect(tabs(region()).map((t) => t.textContent?.trim())).toEqual(['Changes', 'History']);
  });

  // plan-multi_repo_workspace/REQ-13, REQ-9 (spec GitExplorerPanel): one repository with a git error
  it('shows the name, "Refresh" and the message of one repository with a git error, and no tabs', async () => {
    const onRefresh = vi.fn();
    const { region } = renderWith({
      lookup: one({ root: '/home/dev/my-project', name: 'my-project', path: '.', error: 'fatal: bad object HEAD' }),
      onRefresh,
    });
    expect(region().querySelector('[title="/home/dev/my-project"]')!.textContent).toBe('my-project');
    expect(region().querySelector('[role="alert"]')!.textContent).toBe('fatal: bad object HEAD');
    expect(tabs(region())).toHaveLength(0);
    expect(repositoryList(region())).toBeNull();
    flushSync(() => refreshButton(region())!.click());
    expect(onRefresh).toHaveBeenCalledTimes(1);
    await settlePanel();
    expect(callsTo('/api/git/changes')).toBe(0);
  });

  // plan-multi_repo_workspace/REQ-7, REQ-8
  it('shows the repository list in list order, with "Refresh", for several repositories', () => {
    const onRefresh = vi.fn();
    const { region } = renderWith({ lookup: several, onRefresh });
    const list = repositoryList(region());
    expect(list, 'a list named "Repositories"').not.toBeNull();
    const entries = [...list!.querySelectorAll('li button')];
    expect(entries.map((e) => e.getAttribute('title'))).toEqual([`${WS}/api`, `${WS}/web/app`]);
    expect(entries[0]!.textContent).toContain('api');
    expect(entries[1]!.textContent).toContain('web/app');
    expect(entries[1]!.textContent).toContain('detached a1b2c3d');
    flushSync(() => refreshButton(region())!.click());
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  // plan-multi_repo_workspace/REQ-14, REQ-21 (spec GitExplorerPanel): both tabs read every covered root
  it('reads the changes and, once "History" opens, the history of every repository', async () => {
    const { region } = renderWith({ lookup: several });
    await until(() => callsTo('/api/git/changes') === 2);
    expect(pathsOf('/api/git/changes').sort()).toEqual([`${WS}/api`, `${WS}/web/app`]);
    expect(callsTo('/api/git/history')).toBe(0);
    flushSync(() => tabNamed(region(), 'History').click());
    await until(() => callsTo('/api/git/history') === 2);
    expect(pathsOf('/api/git/history').sort()).toEqual([`${WS}/api`, `${WS}/web/app`]);
  });

  // plan-multi_repo_workspace/REQ-14, REQ-19 (spec GitExplorerPanel)
  it('shows "Loading…" until each repository has its first answer, then one group per repository', async () => {
    const { region } = renderWith({ lookup: several });
    await until(() => callsTo('/api/git/changes') === 2);
    answerChangesOf(`${WS}/api`, { changes: [changeEntry('server.ts')] });
    await settlePanel();
    expect(region().textContent).toContain('Loading…');
    expect(region().textContent).not.toContain('server.ts');
    answerChangesOf(`${WS}/web/app`, { error: 'git_error', message: 'fatal: not a git repository' }, 500);
    await until(() => region().querySelector('section[aria-label="app"]') !== null);
    expect(region().textContent).not.toContain('Loading…');
    const apiGroup = region().querySelector('section[aria-label="api"]')!;
    const appGroup = region().querySelector('section[aria-label="app"]')!;
    expect(apiGroup.compareDocumentPosition(appGroup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(apiGroup.textContent).toContain('server.ts');
    expect(appGroup.querySelector('[role="alert"]')!.textContent).toBe('fatal: not a git repository');
    expect(apiGroup.querySelector('[role="alert"]')).toBeNull();
  });

  // plan-multi_repo_workspace/REQ-19: a repository with a git error in the lookup is still read in "Changes"
  it('reads the changes of a repository whose entry has a git error', async () => {
    const lookup: RepositoryLookupState = {
      status: 'repositories',
      repositories: [
        { root: `${WS}/api`, name: 'api', path: 'api', branch: { kind: 'branch', name: 'main' } },
        { root: `${WS}/web/app`, name: 'app', path: 'web/app', error: 'fatal: bad HEAD' },
      ],
    };
    renderWith({ lookup });
    await until(() => callsTo('/api/git/changes') === 2);
    expect(pathsOf('/api/git/changes').sort()).toEqual([`${WS}/api`, `${WS}/web/app`]);
  });

  // plan-multi_repo_workspace/REQ-20
  it('shows the changes of one repository with no repository group', async () => {
    const { region } = renderWith({ lookup: repository });
    await until(() => callsTo('/api/git/changes') === 1);
    answerLast('/api/git/changes', { changes: [changeEntry('a.ts')] });
    await until(() => region().textContent!.includes('a.ts'));
    expect(region().querySelector('section[aria-label="my-project"]')).toBeNull();
    expect(region().querySelector('[role="listbox"]')!.getAttribute('aria-label')).toBe('Changed files');
  });

  // plan-multi_repo_workspace/REQ-14: "Refresh" reads every root again
  it('reads the changes of every repository again on "Refresh"', async () => {
    const { region } = renderWith({ lookup: several });
    await until(() => callsTo('/api/git/changes') === 2);
    flushSync(() => refreshButton(region())!.click());
    await until(() => callsTo('/api/git/changes') === 4);
    expect(pathsOf('/api/git/changes').slice(2).sort()).toEqual([`${WS}/api`, `${WS}/web/app`]);
  });

  // plan-multi_repo_workspace/REQ-11
  it.each([
    ['under the second repository', `${WS}/web/app/src`],
    ['above the repositories', WS],
  ])('refreshes with no click on a turn end of a session %s', async (_name, folder) => {
    const onRefresh = vi.fn();
    const props = { lookup: several, onRefresh };
    const { update } = renderWith({ ...props, sessions: [summary('b', folder, 'working')] });
    await until(() => callsTo('/api/git/changes') === 2);
    update({ ...props, sessions: [summary('b', folder, 'idle')] });
    await until(() => callsTo('/api/git/changes') === 4);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not refresh on a turn end of a session beside the repositories', async () => {
    const onRefresh = vi.fn();
    const props = { lookup: several, onRefresh };
    const { update } = renderWith({ ...props, sessions: [summary('b', `${WS}/web/other`, 'working')] });
    await until(() => callsTo('/api/git/changes') === 2);
    update({ ...props, sessions: [summary('b', `${WS}/web/other`, 'idle')] });
    await settlePanel();
    expect(callsTo('/api/git/changes')).toBe(2);
    expect(onRefresh).not.toHaveBeenCalled();
  });
});

/** Answers the pending request to `pathname` for `root`. */
function answerPathOf(pathname: string, root: string, body: unknown, status = 200) {
  const urls = fetchMock.mock.calls.map((call) => new URL(String(call[0]), 'http://localhost'));
  let index = urls.length - 1;
  while (index >= 0 && !(urls[index]!.pathname === pathname && urls[index]!.searchParams.get('path') === root)) index--;
  pending[index]!(new Response(JSON.stringify(body), { status }));
}
const dated = (char: string, day: number, message: string) => ({
  hash: char.repeat(40),
  shortHash: char.repeat(7),
  parents: [],
  message,
  author: 'Ada',
  date: `2026-11-${String(day).padStart(2, '0')}T10:00:00Z`,
  committerDate: `2026-11-${String(day).padStart(2, '0')}T10:00:00Z`,
});
const historyPanelOf = (region: HTMLElement) => [...region.querySelectorAll<HTMLElement>('[role="tabpanel"]')].find((p) => !isHidden(p))!;
const historyRows = (region: HTMLElement) => [...(historyPanelOf(region).querySelector('[aria-label="Commits"]')?.querySelectorAll('button') ?? [])];
const markColor = (scope: Element | null | undefined) => scope?.querySelector<HTMLElement>('.git-repository-mark')?.style.backgroundColor;

describe('GitExplorerPanel combined history', () => {
  async function openHistory(lookup: RepositoryLookupState = several) {
    const view = renderWith({ lookup });
    await until(() => callsTo('/api/git/changes') === 2);
    flushSync(() => tabNamed(view.region(), 'History').click());
    await until(() => callsTo('/api/git/history') === 2);
    return view;
  }

  // plan-multi_repo_workspace/REQ-21, REQ-22
  it('shows "Loading…" until every repository answers, then the commits of all, newest first, each with its repository name', async () => {
    const { region } = await openHistory();
    answerPathOf('/api/git/history', `${WS}/api`, { commits: [dated('a', 9, 'api newest'), dated('b', 3, 'api oldest')], hasMore: false });
    await settlePanel();
    expect(historyPanelOf(region()).textContent).toContain('Loading…');
    expect(historyPanelOf(region()).textContent).not.toContain('api newest');
    answerPathOf('/api/git/history', `${WS}/web/app`, { commits: [dated('c', 5, 'app middle')], hasMore: false });
    await until(() => historyRows(region()).length === 3);
    const rows = historyRows(region());
    expect(rows[0]!.textContent).toContain('api newest');
    expect(rows[1]!.textContent).toContain('app middle');
    expect(rows[2]!.textContent).toContain('api oldest');
    expect(rows[0]!.querySelector(`[title="${WS}/api"]`)?.textContent).toBe('api');
    expect(rows[1]!.querySelector(`[title="${WS}/web/app"]`)?.textContent).toBe('app');
  });

  // plan-multi_repo_workspace/REQ-23
  it('gives each repository the same colour in the repository list, the Changes groups and the History rows', async () => {
    const { region } = await openHistory();
    answerChangesOf(`${WS}/api`, { changes: [changeEntry('server.ts')] });
    answerChangesOf(`${WS}/web/app`, { changes: [changeEntry('ui.ts')] });
    answerPathOf('/api/git/history', `${WS}/api`, { commits: [dated('a', 9, 'api commit')], hasMore: false });
    answerPathOf('/api/git/history', `${WS}/web/app`, { commits: [dated('c', 5, 'app commit')], hasMore: false });
    await until(() => historyRows(region()).length === 2);
    await until(() => region().querySelector('section[aria-label="app"]') !== null);
    const entries = [...repositoryList(region())!.querySelectorAll('li')];
    const header = entries.map((entry) => markColor(entry));
    const groups = ['api', 'app'].map((name) => markColor(region().querySelector(`section[aria-label="${name}"]`)));
    const history = historyRows(region()).map((row) => markColor(row));
    expect(header[0]).toBeTruthy();
    expect(header[0]).not.toBe(header[1]);
    expect(groups).toEqual(header);
    expect(history).toEqual(header);
  });

  // plan-multi_repo_workspace/REQ-24, plan-git_graph/REQ-12
  it('labels the tip of each repository with the branch of the lookup', async () => {
    const { region } = await openHistory();
    answerPathOf('/api/git/history', `${WS}/api`, { commits: [dated('a', 9, 'api tip'), dated('b', 1, 'api old')], hasMore: false });
    answerPathOf('/api/git/history', `${WS}/web/app`, { commits: [dated('c', 5, 'app tip')], hasMore: false });
    await until(() => historyRows(region()).length === 3);
    const labelled = (row: Element, text: string) => [...row.querySelectorAll('*')].some((el) => el.textContent === text);
    const [apiTip, appTip, apiOld] = historyRows(region());
    expect(labelled(apiTip!, 'main')).toBe(true);
    expect(labelled(appTip!, 'detached')).toBe(true);
    expect(labelled(apiOld!, 'main') || labelled(apiOld!, 'detached')).toBe(false);
  });

  // plan-multi_repo_workspace/REQ-26
  it('shows the error of a failed repository as "<name>: <message>" above the commits of the others', async () => {
    const { region } = await openHistory();
    answerPathOf('/api/git/history', `${WS}/api`, { commits: [dated('a', 9, 'api commit')], hasMore: false });
    answerPathOf('/api/git/history', `${WS}/web/app`, { error: 'git_error', message: 'fatal: bad object HEAD' }, 500);
    await until(() => historyRows(region()).length === 1);
    const alert = historyPanelOf(region()).querySelector('[role="alert"]');
    expect(alert!.textContent).toBe('app: fatal: bad object HEAD');
    expect(alert!.compareDocumentPosition(historyRows(region())[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows only the messages, in list order, when every repository fails', async () => {
    const { region } = await openHistory();
    answerPathOf('/api/git/history', `${WS}/web/app`, { error: 'git_error', message: 'app broken' }, 500);
    answerPathOf('/api/git/history', `${WS}/api`, { error: 'git_error', message: 'api broken' }, 500);
    await until(() => historyPanelOf(region()).querySelectorAll('[role="alert"]').length === 2);
    const panel = historyPanelOf(region());
    expect([...panel.querySelectorAll('[role="alert"]')].map((a) => a.textContent)).toEqual(['api: api broken', 'app: app broken']);
    expect(panel.querySelector('[aria-label="Commits"]')).toBeNull();
    expect(panel.textContent).not.toContain('No commits yet');
    expect(panel.textContent).not.toContain('Loading…');
  });

  // plan-multi_repo_workspace/REQ-27
  it('shows the commits of a single repository with no repository mark', async () => {
    const { region } = renderWith({ lookup: repository });
    flushSync(() => tabNamed(region(), 'History').click());
    await until(() => callsTo('/api/git/history') === 1);
    answerLast('/api/git/history', { commits: [dated('a', 9, 'only commit')], hasMore: false });
    await until(() => historyRows(region()).length === 1);
    const row = historyRows(region())[0]!;
    expect(row.textContent).not.toContain('my-project');
    expect(row.querySelector('.git-repository-mark')).toBeNull();
    expect([...row.querySelectorAll('*')].some((el) => el.textContent === 'main'), 'the branch label stays').toBe(true);
  });

  // plan-multi_repo_workspace/REQ-21: "Refresh" reads the first page of every root again
  it('reads the first history page of every repository again on "Refresh"', async () => {
    const { region } = await openHistory();
    answerPathOf('/api/git/history', `${WS}/api`, { commits: [dated('a', 9, 'api commit')], hasMore: false });
    answerPathOf('/api/git/history', `${WS}/web/app`, { commits: [dated('c', 5, 'app commit')], hasMore: false });
    await until(() => historyRows(region()).length === 2);
    flushSync(() => refreshButton(region())!.click());
    await until(() => callsTo('/api/git/history') === 4);
    expect(pathsOf('/api/git/history').slice(2).sort()).toEqual([`${WS}/api`, `${WS}/web/app`]);
    expect(historyRows(region()), 'the commits stay until the refresh answers').toHaveLength(2);
  });
});

const three: RepositoryLookupState = {
  status: 'repositories',
  repositories: [
    { root: `${WS}/api`, name: 'api', path: 'api', branch: { kind: 'branch', name: 'main' } },
    { root: `${WS}/tools`, name: 'tools', path: 'tools', branch: { kind: 'branch', name: 'main' } },
    { root: `${WS}/web/app`, name: 'app', path: 'web/app', branch: { kind: 'branch', name: 'main' } },
  ],
};
const THREE_ROOTS = [`${WS}/api`, `${WS}/tools`, `${WS}/web/app`];
const NAMES: Record<string, string> = { [`${WS}/api`]: 'api', [`${WS}/tools`]: 'tools', [`${WS}/web/app`]: 'app' };
const COMMIT_CHAR: Record<string, string> = { [`${WS}/api`]: 'a', [`${WS}/tools`]: 'b', [`${WS}/web/app`]: 'c' };
// The filter is kept per folder for the life of the module, so each test uses its own folder.
let filterFolderCount = 0;
const newFilterFolder = () => `/home/dev/ws-filter-${++filterFolderCount}`;
/** Answers every request to `pathname` for `root`, the ones already answered included (a no-op for those). */
function answerAllOf(pathname: string, root: string, body: unknown) {
  fetchMock.mock.calls.forEach((call, index) => {
    const url = new URL(String(call[0]), 'http://localhost');
    if (url.pathname === pathname && url.searchParams.get('path') === root) pending[index]!(new Response(JSON.stringify(body)));
  });
}
const answerChangesOfAll = () => THREE_ROOTS.forEach((root) => answerAllOf('/api/git/changes', root, { changes: [changeEntry(`${NAMES[root]}.ts`)] }));
const answerHistoryOfAll = () =>
  THREE_ROOTS.forEach((root) =>
    answerAllOf('/api/git/history', root, { commits: [dated(COMMIT_CHAR[root]!, 5, `${NAMES[root]} commit`)], hasMore: false }),
  );
const filterEntries = (region: HTMLElement) => [...repositoryList(region)!.querySelectorAll<HTMLElement>('li button')];
const entryOf = (region: HTMLElement, root: string) => filterEntries(region).find((b) => b.getAttribute('title') === root)!;
const allRepositories = (region: HTMLElement) => [...region.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent?.trim() === 'All repositories');
const groupNames = (region: HTMLElement) =>
  ['api', 'tools', 'app'].filter((name) => region.querySelector(`section[aria-label="${name}"]`) !== null);
const pathsAfter = (pathname: string, start: number) => pathsOf(pathname).slice(start);

describe('GitExplorerPanel repository filter', () => {
  async function openFiltered(folder = newFilterFolder(), extra: Partial<React.ComponentProps<typeof GitExplorerPanel>> = {}) {
    const view = renderWith({ lookup: three, folder, ...extra });
    await until(() => callsTo('/api/git/changes') === 3);
    answerChangesOfAll();
    await until(() => groupNames(view.region()).length === 3);
    return view;
  }
  async function showHistory(region: () => HTMLElement) {
    flushSync(() => tabNamed(region(), 'History').click());
    await until(() => pending.length === fetchMock.mock.calls.length && paths().includes('/api/git/history'));
    answerHistoryOfAll();
    await settlePanel();
  }
  const historyTexts = (region: HTMLElement) => historyRows(region).map((row) => row.textContent ?? '');

  // plan-multi_repo_workspace/REQ-28, REQ-29
  it('shows only the chosen repository in "Changes" and reads only its history in "History"', async () => {
    const { region } = await openFiltered();
    flushSync(() => entryOf(region(), `${WS}/web/app`).click());
    answerChangesOfAll();
    await until(() => groupNames(region()).join() === 'app');
    expect(region().textContent).not.toContain('api.ts');
    expect(region().textContent).not.toContain('tools.ts');
    expect(entryOf(region(), `${WS}/web/app`).getAttribute('aria-pressed')).toBe('true');
    expect(allRepositories(region())!.getAttribute('aria-pressed')).toBe('false');

    flushSync(() => tabNamed(region(), 'History').click());
    await until(() => callsTo('/api/git/history') >= 1);
    await settlePanel();
    expect(pathsOf('/api/git/history')).toEqual([`${WS}/web/app`]);
    answerHistoryOfAll();
    await until(() => historyRows(region()).length === 1);
    expect(historyTexts(region())[0]).toContain('app commit');
  });

  // plan-multi_repo_workspace/REQ-28, REQ-29
  it('shows two chosen repositories in both tabs, in list order', async () => {
    const { region } = await openFiltered();
    flushSync(() => entryOf(region(), `${WS}/web/app`).click());
    flushSync(() => entryOf(region(), `${WS}/api`).click());
    answerChangesOfAll();
    await until(() => groupNames(region()).join() === 'api,app');
    const apiGroup = region().querySelector('section[aria-label="api"]')!;
    const appGroup = region().querySelector('section[aria-label="app"]')!;
    expect(apiGroup.compareDocumentPosition(appGroup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await showHistory(region);
    expect([...pathsOf('/api/git/history')].sort()).toEqual([`${WS}/api`, `${WS}/web/app`]);
    await until(() => historyRows(region()).length === 2);
    const texts = historyTexts(region()).join('|');
    expect(texts).toContain('api commit');
    expect(texts).toContain('app commit');
    expect(texts).not.toContain('tools commit');
  });

  // plan-multi_repo_workspace/REQ-23 with the filter: the colour of the position in the full list
  it('keeps the colour of the chosen repository from its position in the full list', async () => {
    const { region } = await openFiltered();
    const headerColor = markColor(entryOf(region(), `${WS}/web/app`));
    const firstColor = markColor(entryOf(region(), `${WS}/api`));
    flushSync(() => entryOf(region(), `${WS}/web/app`).click());
    answerChangesOfAll();
    await until(() => groupNames(region()).join() === 'app');
    expect(headerColor).toBeTruthy();
    expect(headerColor).not.toBe(firstColor);
    expect(markColor(region().querySelector('section[aria-label="app"]'))).toBe(headerColor);

    await showHistory(region);
    await until(() => historyRows(region()).length === 1);
    expect(markColor(historyRows(region())[0])).toBe(headerColor);
  });

  // plan-multi_repo_workspace/REQ-28 (spec GitExplorerPanel): one chosen repository keeps the look of several
  it('keeps the repository group and the row mark with one chosen repository', async () => {
    const { region } = await openFiltered();
    flushSync(() => entryOf(region(), `${WS}/tools`).click());
    answerChangesOfAll();
    await until(() => groupNames(region()).join() === 'tools');
    await showHistory(region);
    await until(() => historyRows(region()).length === 1);
    const row = historyRows(region())[0]!;
    expect(row.querySelector('.git-repository-mark')).not.toBeNull();
    expect(row.querySelector(`[title="${WS}/tools"]`)?.textContent).toBe('tools');
  });

  it('shows a history error of the one chosen repository as "<name>: <message>"', async () => {
    const { region } = await openFiltered();
    flushSync(() => entryOf(region(), `${WS}/tools`).click());
    flushSync(() => tabNamed(region(), 'History').click());
    await until(() => callsTo('/api/git/history') === 1);
    answerPathOf('/api/git/history', `${WS}/tools`, { error: 'git_error', message: 'fatal: bad object HEAD' }, 500);
    await until(() => historyPanelOf(region()).querySelector('[role="alert"]') !== null);
    expect(historyPanelOf(region()).querySelector('[role="alert"]')!.textContent).toBe('tools: fatal: bad object HEAD');
  });

  // plan-multi_repo_workspace/REQ-30
  it('shows every repository again in both tabs on "All repositories", reading again the ones shown again', async () => {
    const { region } = await openFiltered();
    flushSync(() => entryOf(region(), `${WS}/web/app`).click());
    answerChangesOfAll();
    await until(() => groupNames(region()).join() === 'app');
    await showHistory(region);
    await until(() => historyRows(region()).length === 1);
    const changesBefore = callsTo('/api/git/changes');

    flushSync(() => allRepositories(region())!.click());
    expect(allRepositories(region())!.getAttribute('aria-pressed')).toBe('true');
    expect(filterEntries(region()).map((e) => e.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false']);
    await until(() => pathsAfter('/api/git/changes', changesBefore).includes(`${WS}/tools`));
    expect(pathsAfter('/api/git/changes', changesBefore)).toContain(`${WS}/api`);
    await until(() => pathsOf('/api/git/history').includes(`${WS}/api`) && pathsOf('/api/git/history').includes(`${WS}/tools`));
    answerChangesOfAll();
    answerHistoryOfAll();
    await until(() => historyRows(region()).length === 3);
    expect(groupNames(region())).toEqual(['api', 'tools', 'app']);
  });

  // plan-multi_repo_workspace/REQ-30: a filter left with no repository counts as no filter
  it('shows every repository when the chosen ones are all toggled off', async () => {
    const { region } = await openFiltered();
    flushSync(() => entryOf(region(), `${WS}/web/app`).click());
    answerChangesOfAll();
    await until(() => groupNames(region()).join() === 'app');
    flushSync(() => entryOf(region(), `${WS}/web/app`).click());
    expect(allRepositories(region())!.getAttribute('aria-pressed')).toBe('true');
    await until(() => callsTo('/api/git/changes') > 4);
    answerChangesOfAll();
    await until(() => groupNames(region()).length === 3);
  });

  // plan-multi_repo_workspace/REQ-28 (Filter life): a repository that a refresh removes leaves the filter
  it('shows every remaining repository when the chosen one is gone from a new lookup', async () => {
    const folder = newFilterFolder();
    const { region, update } = await openFiltered(folder);
    flushSync(() => entryOf(region(), `${WS}/web/app`).click());
    answerChangesOfAll();
    await until(() => groupNames(region()).join() === 'app');
    const lookup: RepositoryLookupState = { status: 'repositories', repositories: three.status === 'repositories' ? three.repositories.slice(0, 2) : [] };
    update({ lookup, folder });
    expect(filterEntries(region())).toHaveLength(2);
    expect(allRepositories(region())!.getAttribute('aria-pressed')).toBe('true');
    await until(() => pathsOf('/api/git/changes').filter((p) => p === `${WS}/tools`).length >= 2);
    answerChangesOfAll();
    await until(() => groupNames(region()).join() === 'api,tools');
  });

  // plan-multi_repo_workspace/REQ-28 (Filter life): the filter survives closing and opening the panel
  it('keeps the filter of the folder when the panel is closed and opened again', async () => {
    const folder = newFilterFolder();
    const first = await openFiltered(folder);
    flushSync(() => entryOf(first.region(), `${WS}/web/app`).click());
    first.unmount();
    const before = callsTo('/api/git/changes');
    const second = renderWith({ lookup: three, folder });
    expect(entryOf(second.region(), `${WS}/web/app`).getAttribute('aria-pressed')).toBe('true');
    await until(() => callsTo('/api/git/changes') > before);
    await settlePanel();
    expect(pathsAfter('/api/git/changes', before)).toEqual([`${WS}/web/app`]);
    answerChangesOfAll();
    await until(() => groupNames(second.region()).join() === 'app');
  });

  it('starts with no filter on another folder', async () => {
    const first = await openFiltered();
    flushSync(() => entryOf(first.region(), `${WS}/web/app`).click());
    first.unmount();
    const second = renderWith({ lookup: three, folder: newFilterFolder() });
    expect(allRepositories(second.region())!.getAttribute('aria-pressed')).toBe('true');
  });

  // plan-multi_repo_workspace/REQ-28, REQ-29: "Refresh" reads only the chosen repositories
  it('reads only the chosen repositories again on "Refresh"', async () => {
    const onRefresh = vi.fn();
    const { region } = await openFiltered(undefined, { onRefresh });
    flushSync(() => entryOf(region(), `${WS}/web/app`).click());
    answerChangesOfAll();
    await showHistory(region);
    await until(() => historyRows(region()).length === 1);
    const changesBefore = callsTo('/api/git/changes');
    const historyBefore = callsTo('/api/git/history');
    flushSync(() => refreshButton(region())!.click());
    expect(onRefresh).toHaveBeenCalledTimes(1);
    await until(() => callsTo('/api/git/changes') > changesBefore && callsTo('/api/git/history') > historyBefore);
    await settlePanel();
    expect(pathsAfter('/api/git/changes', changesBefore)).toEqual([`${WS}/web/app`]);
    expect(pathsAfter('/api/git/history', historyBefore)).toEqual([`${WS}/web/app`]);
  });

  // plan-multi_repo_workspace/REQ-11 with the filter: the turn end still watches every covered root
  it('refreshes on a turn end in a repository left out of the filter', async () => {
    const onRefresh = vi.fn();
    const folder = newFilterFolder();
    const props = { lookup: three, folder, onRefresh };
    const { region, update } = await openFiltered(folder, { onRefresh, sessions: [summary('b', `${WS}/api/src`, 'working')] });
    flushSync(() => entryOf(region(), `${WS}/web/app`).click());
    answerChangesOfAll();
    await settlePanel();
    const before = callsTo('/api/git/changes');
    update({ ...props, sessions: [summary('b', `${WS}/api/src`, 'idle')] });
    await until(() => callsTo('/api/git/changes') > before);
    await settlePanel();
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(pathsAfter('/api/git/changes', before)).toEqual([`${WS}/web/app`]);
  });

  // plan-multi_repo_workspace/REQ-31
  it('offers no repository list and no "All repositories" with a single repository', () => {
    const { region } = renderWith({ lookup: repository, folder: newFilterFolder() });
    expect(repositoryList(region())).toBeNull();
    expect(allRepositories(region())).toBeUndefined();
    expect([...region().querySelectorAll('button')].some((b) => b.hasAttribute('aria-pressed'))).toBe(false);
  });
});

// plan-ui_transitions/REQ-6, REQ-26: the panel mounted through ExitPresence, open then closed
describe('GitExplorerPanel motion', () => {
  const EXIT_MS = 100;
  const panel = () => document.querySelector<HTMLElement>('section.git-explorer-panel');

  function renderOwned(open: boolean, root: Root): void {
    flushSync(() =>
      root.render(<ExitPresence>{open && <GitExplorerPanel lookup={one(myProject({ kind: 'branch', name: 'main' }))} />}</ExitPresence>),
    );
  }

  function ownedRoot(): Root {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);
    return root;
  }

  afterEach(() => document.documentElement.style.removeProperty('--motion-duration-exit'));

  it('while open it is exposed and not leaving', () => {
    document.documentElement.style.setProperty('--motion-duration-exit', `${EXIT_MS}ms`);
    const root = ownedRoot();
    renderOwned(true, root);
    expect(panel()).not.toBeNull();
    expect(panel()!.classList.contains('is-leaving')).toBe(false);
    expect(panel()!.hasAttribute('aria-hidden')).toBe(false);
  });

  it('when closed it stays while it slides out, marked leaving and hidden from assistive technologies, then goes', async () => {
    document.documentElement.style.setProperty('--motion-duration-exit', `${EXIT_MS}ms`);
    const root = ownedRoot();
    renderOwned(true, root);
    renderOwned(false, root);
    expect(panel(), 'the panel plays its exit').not.toBeNull();
    expect(panel()!.classList.contains('is-leaving')).toBe(true);
    expect(panel()!.getAttribute('aria-hidden')).toBe('true');
    await new Promise((resolve) => setTimeout(resolve, EXIT_MS * 3));
    expect(panel(), 'removed after the exit').toBeNull();
  });

  it('reopened during its exit it is a panel that is not leaving', () => {
    document.documentElement.style.setProperty('--motion-duration-exit', `${EXIT_MS}ms`);
    const root = ownedRoot();
    renderOwned(true, root);
    renderOwned(false, root);
    renderOwned(true, root);
    expect(document.querySelectorAll('section.git-explorer-panel')).toHaveLength(1);
    expect(panel()!.classList.contains('is-leaving')).toBe(false);
    expect(panel()!.hasAttribute('aria-hidden')).toBe(false);
  });
});
