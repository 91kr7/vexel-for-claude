// @vitest-environment jsdom
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitExplorerPanel } from './GitExplorerPanel';
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
    const entries = [...list!.querySelectorAll('li')];
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
