// @vitest-environment jsdom
// Unit tests of ChangesTab (plan-git_explorer, batch uncommitted-changes; list box of plan-git_graph, batch open-source-explorer;
// one group per repository of plan-multi_repo_workspace, batch grouped-changes).
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangesTab } from './ChangesTab';
import type { ChangeEntry, ChangesState } from './changes-store';
import { repositoryColor } from './repository-colors';
import type { CoveredRepository } from './repository-lookup-store';

const ROOT = '/home/dev/project';
const single: CoveredRepository[] = [{ root: ROOT, name: 'project', path: '.', branch: { kind: 'branch', name: 'main' } }];
const loadedState = (entries: ChangeEntry[]): ChangesState => ({ status: 'loaded', changes: entries });
const changes: ChangeEntry[] = [
  { group: 'unstaged', kind: 'modified', path: 'src/both.ts' },
  { group: 'staged', kind: 'added', path: 'src/new.ts' },
  { group: 'staged', kind: 'renamed', path: 'docs/new-name.md', oldPath: 'docs/old-name.md' },
  { group: 'staged', kind: 'modified', path: 'src/both.ts' },
  { group: 'unstaged', kind: 'deleted', path: 'gone.txt' },
  { group: 'unstaged', kind: 'untracked', path: 'notes.txt' },
];

let pending: Array<(response: Response) => void>;
let fetchMock: ReturnType<typeof vi.fn>;
const roots: Root[] = [];

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

function render(entries: ChangeEntry[] = changes): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  flushSync(() => root.render(<ChangesTab repositories={single} changes={[loadedState(entries)]} />));
  return container;
}

const group = (view: HTMLElement, name: string) => view.querySelector<HTMLElement>(`[role="group"][aria-label="${name}"]`);
const options = (scope: HTMLElement) => [...scope.querySelectorAll<HTMLElement>('[role="option"]')];
const option = (scope: HTMLElement, text: string) => options(scope).find((o) => o.textContent?.includes(text));
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
const until = (check: () => boolean) => vi.waitFor(() => expect(check()).toBe(true));
const requestedUrl = (call: number) => new URL(String(fetchMock.mock.calls[call]?.[0]), 'http://localhost');
const answer = (call: number, body: unknown, status = 200) => pending[call]!(new Response(JSON.stringify(body), { status }));

describe('ChangesTab', () => {
  // plan-git_explorer/REQ-11: "Staged" first, then "Unstaged"
  it('shows the group "Staged" before the group "Unstaged", each with its files', () => {
    const view = render();
    const staged = group(view, 'Staged');
    const unstaged = group(view, 'Unstaged');
    expect(staged).not.toBeNull();
    expect(unstaged).not.toBeNull();
    expect(staged!.compareDocumentPosition(unstaged!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(options(staged!)).toHaveLength(3);
    expect(options(unstaged!)).toHaveLength(3);
  });

  // plan-git_explorer/REQ-10: the kind label of each file
  it('labels each file with its kind', () => {
    const view = render();
    const label = (scope: HTMLElement, text: string) => option(scope, text)!.textContent;
    expect(label(group(view, 'Staged')!, 'src/new.ts')).toContain('Added');
    expect(label(group(view, 'Staged')!, 'src/both.ts')).toContain('Modified');
    expect(label(group(view, 'Staged')!, 'new-name.md')).toContain('Renamed');
    expect(label(group(view, 'Unstaged')!, 'gone.txt')).toContain('Deleted');
    expect(label(group(view, 'Unstaged')!, 'notes.txt')).toContain('Untracked');
    expect(label(group(view, 'Unstaged')!, 'src/both.ts')).toContain('Modified');
  });

  it('shows a rename as "<old path> → <new path>", with the full path text as tooltip', () => {
    const rename = option(group(render(), 'Staged')!, 'new-name.md')!;
    expect(rename.textContent).toContain('docs/old-name.md → docs/new-name.md');
    expect(rename.querySelector('[title="docs/old-name.md → docs/new-name.md"]')).not.toBeNull();
  });

  it('gives each path its full text as tooltip', () => {
    const entry = option(group(render(), 'Unstaged')!, 'notes.txt')!;
    expect(entry.querySelector('[title="notes.txt"]')).not.toBeNull();
  });

  it('does not show a group with no entries', () => {
    const view = render([{ group: 'unstaged', kind: 'untracked', path: 'notes.txt' }]);
    expect(group(view, 'Staged')).toBeNull();
    expect(group(view, 'Unstaged')).not.toBeNull();
  });

  // plan-git_explorer/REQ-12: a click shows the diff of that file in that group
  it('loads the diff of the clicked file in its group, shows "Loading…", then the diff', async () => {
    const view = render();
    const staged = option(group(view, 'Staged')!, 'src/both.ts')!;
    const unstaged = option(group(view, 'Unstaged')!, 'src/both.ts')!;
    expect(staged.getAttribute('aria-selected')).toBe('false');
    flushSync(() => staged.click());
    await until(() => fetchMock.mock.calls.length === 1);
    expect(staged.getAttribute('aria-selected')).toBe('true');
    expect(unstaged.getAttribute('aria-selected')).toBe('false');
    expect(requestedUrl(0).searchParams.get('path')).toBe(ROOT);
    expect(requestedUrl(0).searchParams.get('group')).toBe('staged');
    expect(requestedUrl(0).searchParams.get('file')).toBe('src/both.ts');
    await until(() => view.textContent!.includes('Loading…'));
    answer(0, { binary: false, cut: false, lines: [{ kind: 'removed', text: 'before' }, { kind: 'added', text: 'after' }] });
    await until(() => view.textContent!.includes('+after'));
    expect(view.textContent).toContain('-before');
    expect(view.textContent).not.toContain('Loading…');
  });

  it('sends the old path of a clicked rename', async () => {
    const view = render();
    flushSync(() => option(group(view, 'Staged')!, 'new-name.md')!.click());
    await until(() => fetchMock.mock.calls.length === 1);
    expect(requestedUrl(0).searchParams.get('file')).toBe('docs/new-name.md');
    expect(requestedUrl(0).searchParams.get('oldPath')).toBe('docs/old-name.md');
  });

  it('shows the unstaged diff after a click on the same file in the other group', async () => {
    const view = render();
    flushSync(() => option(group(view, 'Staged')!, 'src/both.ts')!.click());
    await until(() => fetchMock.mock.calls.length === 1);
    flushSync(() => option(group(view, 'Unstaged')!, 'src/both.ts')!.click());
    await until(() => fetchMock.mock.calls.length === 2);
    expect(requestedUrl(1).searchParams.get('group')).toBe('unstaged');
    expect(option(group(view, 'Staged')!, 'src/both.ts')!.getAttribute('aria-selected')).toBe('false');
    expect(option(group(view, 'Unstaged')!, 'src/both.ts')!.getAttribute('aria-selected')).toBe('true');
  });

  // plan-git_explorer/REQ-14
  it('shows the binary note for a binary file', async () => {
    const view = render();
    flushSync(() => option(group(view, 'Unstaged')!, 'notes.txt')!.click());
    await until(() => pending.length === 1);
    answer(0, { binary: true, cut: false, lines: [] });
    await until(() => view.textContent!.includes('Binary file, no diff shown'));
  });

  it('shows a diff error in an alert with its message', async () => {
    const view = render();
    flushSync(() => option(group(view, 'Unstaged')!, 'gone.txt')!.click());
    await until(() => pending.length === 1);
    answer(0, { error: 'git_error', message: 'fatal: bad revision' }, 500);
    await until(() => view.querySelector('[role="alert"]') !== null);
    expect(view.querySelector('[role="alert"]')!.textContent).toBe('fatal: bad revision');
  });

  // plan-git_graph/REQ-1: the files sit in a list box "Changed files"
  it('shows the files as options of a list box "Changed files"', () => {
    const view = render();
    const listbox = view.querySelector<HTMLElement>('[role="listbox"]');
    expect(listbox?.getAttribute('aria-label')).toBe('Changed files');
    expect(options(listbox!)).toHaveLength(6);
  });

  it('keeps the selected entry selected after a click on it', async () => {
    const view = render();
    const entry = option(group(view, 'Staged')!, 'src/new.ts')!;
    flushSync(() => entry.click());
    await until(() => fetchMock.mock.calls.length === 1);
    flushSync(() => entry.click());
    await settle();
    expect(entry.getAttribute('aria-selected')).toBe('true');
    expect(selectedOptions(view)).toHaveLength(1);
  });

  it('moves the focus with the arrow keys and selects the focused entry with Enter or Space', async () => {
    const view = render();
    const first = option(group(view, 'Staged')!, 'src/new.ts')!;
    const second = option(group(view, 'Staged')!, 'new-name.md')!;
    const third = option(group(view, 'Staged')!, 'src/both.ts')!;
    flushSync(() => first.click());
    await until(() => fetchMock.mock.calls.length === 1);
    flushSync(() => first.focus());
    flushSync(() => first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    await until(() => document.activeElement === second);
    flushSync(() => second.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    flushSync(() => second.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true })));
    await until(() => second.getAttribute('aria-selected') === 'true');
    expect(first.getAttribute('aria-selected')).toBe('false');
    await until(() => fetchMock.mock.calls.length === 2);
    expect(requestedUrl(1).searchParams.get('file')).toBe('docs/new-name.md');
    flushSync(() => second.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    await until(() => document.activeElement === third);
    flushSync(() => third.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })));
    flushSync(() => third.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true })));
    await until(() => third.getAttribute('aria-selected') === 'true');
    await until(() => fetchMock.mock.calls.length === 3);
    expect(requestedUrl(2).searchParams.get('group')).toBe('staged');
    expect(requestedUrl(2).searchParams.get('file')).toBe('src/both.ts');
  });

  it('asks for no diff before a click', async () => {
    render();
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function renderUpdatable(entries: ChangeEntry[]) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  flushSync(() => root.render(<ChangesTab repositories={single} changes={[loadedState(entries)]} />));
  return {
    view: container,
    update: (next: ChangeEntry[]) => flushSync(() => root.render(<ChangesTab repositories={single} changes={[loadedState(next)]} />)),
  };
}

const selectedOptions = (view: HTMLElement) => options(view).filter((o) => o.getAttribute('aria-selected') === 'true');

describe('ChangesTab after a refresh', () => {
  // plan-git_explorer/REQ-26
  it('keeps the entry with the same group and path selected and loads its diff again', async () => {
    const { view, update } = renderUpdatable(changes);
    flushSync(() => option(group(view, 'Unstaged')!, 'src/both.ts')!.click());
    await until(() => pending.length === 1);
    answer(0, { binary: false, cut: false, lines: [{ kind: 'added', text: 'old content' }] });
    await until(() => view.textContent!.includes('+old content'));
    update(changes.map((entry) => ({ ...entry })));
    const selected = selectedOptions(view);
    expect(selected).toHaveLength(1);
    expect(group(view, 'Unstaged')!.contains(selected[0]!)).toBe(true);
    expect(selected[0]!.textContent).toContain('src/both.ts');
    await until(() => pending.length === 2);
    expect(requestedUrl(1).searchParams.get('group')).toBe('unstaged');
    expect(requestedUrl(1).searchParams.get('file')).toBe('src/both.ts');
    await until(() => view.textContent!.includes('Loading…'));
    expect(view.textContent).not.toContain('+old content');
    answer(1, { binary: false, cut: false, lines: [{ kind: 'added', text: 'new content' }] });
    await until(() => view.textContent!.includes('+new content'));
  });

  it('keeps the selection when the entry changes kind in the same group', async () => {
    const { view, update } = renderUpdatable(changes);
    flushSync(() => option(group(view, 'Staged')!, 'src/new.ts')!.click());
    await until(() => pending.length === 1);
    update(changes.map((entry) => (entry.path === 'src/new.ts' ? { ...entry, kind: 'modified' as const } : { ...entry })));
    const selected = selectedOptions(view);
    expect(selected).toHaveLength(1);
    expect(selected[0]!.textContent).toContain('src/new.ts');
    await until(() => pending.length === 2);
  });

  it('closes the selection and the diff when the file is no longer in the same group', async () => {
    const { view, update } = renderUpdatable(changes);
    flushSync(() => option(group(view, 'Staged')!, 'src/both.ts')!.click());
    await until(() => pending.length === 1);
    answer(0, { binary: false, cut: false, lines: [{ kind: 'added', text: 'staged line' }] });
    await until(() => view.textContent!.includes('+staged line'));
    update(changes.filter((entry) => !(entry.group === 'staged' && entry.path === 'src/both.ts')));
    expect(selectedOptions(view)).toHaveLength(0);
    expect(view.textContent).not.toContain('+staged line');
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(view.textContent).not.toContain('Loading…');
  });

  it('keeps the selection closed when the file comes back in a later refresh', async () => {
    const { view, update } = renderUpdatable(changes);
    flushSync(() => option(group(view, 'Unstaged')!, 'notes.txt')!.click());
    await until(() => pending.length === 1);
    update(changes.filter((entry) => entry.path !== 'notes.txt'));
    expect(selectedOptions(view)).toHaveLength(0);
    update(changes.map((entry) => ({ ...entry })));
    expect(selectedOptions(view)).toHaveLength(0);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

function renderStates(states: ChangesState[], repositories: CoveredRepository[] = single) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  flushSync(() => root.render(<ChangesTab repositories={repositories} changes={states} />));
  return {
    view: container,
    update: (next: ChangesState[], nextRepositories: CoveredRepository[] = repositories) =>
      flushSync(() => root.render(<ChangesTab repositories={nextRepositories} changes={next} />)),
  };
}

describe('ChangesTab with one repository', () => {
  // plan-multi_repo_workspace/REQ-20
  it.each<[string, ChangesState, string]>([
    ['loading', { status: 'loading' }, 'Loading…'],
    ['no changes', loadedState([]), 'No uncommitted changes'],
  ])('shows the state "%s" with no repository group', (_name, state, text) => {
    const { view } = renderStates([state]);
    expect(view.textContent).toContain(text);
    expect(view.querySelector('section[aria-label="project"]')).toBeNull();
    expect(view.querySelector(`[title="${ROOT}"]`)).toBeNull();
  });

  // plan-multi_repo_workspace/REQ-20, plan-git_explorer/REQ-6
  it('shows a git error in an alert, with no repository group', () => {
    const { view } = renderStates([{ status: 'error', message: 'fatal: index file corrupt' }]);
    expect(view.querySelector('[role="alert"]')!.textContent).toBe('fatal: index file corrupt');
    expect(view.querySelector('section[aria-label="project"]')).toBeNull();
  });

  // plan-multi_repo_workspace/REQ-20
  it('shows one list box "Changed files" and no repository title', () => {
    const { view } = renderStates([loadedState(changes)]);
    expect([...view.querySelectorAll('[role="listbox"]')].map((l) => l.getAttribute('aria-label'))).toEqual(['Changed files']);
    expect(view.querySelector('section[aria-label="project"]')).toBeNull();
    expect(view.textContent).not.toContain('project');
  });
});

const WS = '/home/dev/ws';
const api: CoveredRepository = { root: `${WS}/api`, name: 'api', path: 'api', branch: { kind: 'branch', name: 'main' } };
const app: CoveredRepository = { root: `${WS}/web/app`, name: 'app', path: 'web/app', branch: { kind: 'branch', name: 'main' } };
const tools: CoveredRepository = { root: `${WS}/tools`, name: 'tools', path: 'tools', branch: { kind: 'branch', name: 'dev' } };
const apiChanges: ChangeEntry[] = [
  { group: 'staged', kind: 'added', path: 'src/server.ts' },
  { group: 'unstaged', kind: 'modified', path: 'README.md' },
];
const appChanges: ChangeEntry[] = [{ group: 'unstaged', kind: 'modified', path: 'README.md' }];

const repositoryGroup = (view: HTMLElement, name: string) => view.querySelector<HTMLElement>(`section[aria-label="${name}"]`);
const repositoryGroups = (view: HTMLElement) => [api, app, tools].map((r) => repositoryGroup(view, r.name)).filter((g) => g !== null);
const listbox = (scope: HTMLElement) => scope.querySelector<HTMLElement>('[role="listbox"]');

describe('ChangesTab with several repositories', () => {
  // plan-multi_repo_workspace/REQ-14
  it('shows one group per repository, in list order', () => {
    const { view } = renderStates([loadedState(apiChanges), loadedState(appChanges), loadedState([])], [api, app, tools]);
    const groups = repositoryGroups(view);
    expect(groups).toHaveLength(3);
    expect(groups[0]!.compareDocumentPosition(groups[1]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(groups[1]!.compareDocumentPosition(groups[2]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(option(groups[0]!, 'src/server.ts')).toBeDefined();
    expect(option(groups[1]!, 'src/server.ts')).toBeUndefined();
  });

  // plan-multi_repo_workspace/REQ-15
  it('heads each group with the repository name, its root as tooltip, and the colour of its position', () => {
    const { view } = renderStates([loadedState(apiChanges), loadedState(appChanges), loadedState([])], [api, app, tools]);
    [api, app, tools].forEach((repository, index) => {
      const region = repositoryGroup(view, repository.name)!;
      const title = region.querySelector(`[title="${repository.root}"]`);
      expect(title, `${repository.name}: a title with the root as tooltip`).not.toBeNull();
      expect(title!.textContent).toContain(repository.name);
      expect(region.innerHTML, `${repository.name}: colour ${repositoryColor(index)}`).toContain(repositoryColor(index));
      const others = [0, 1, 2].filter((i) => i !== index).map(repositoryColor);
      for (const other of others) expect(region.innerHTML).not.toContain(other);
    });
  });

  // plan-multi_repo_workspace/REQ-16
  it('shows "Staged" apart from "Unstaged" inside a group, in a list box named after the repository', () => {
    const { view } = renderStates([loadedState(apiChanges), loadedState(appChanges)], [api, app]);
    const region = repositoryGroup(view, 'api')!;
    expect(listbox(region)!.getAttribute('aria-label')).toBe('Changed files of api');
    expect(listbox(repositoryGroup(view, 'app')!)!.getAttribute('aria-label')).toBe('Changed files of app');
    const staged = group(region, 'Staged')!;
    const unstaged = group(region, 'Unstaged')!;
    expect(staged.compareDocumentPosition(unstaged) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(options(staged).map((o) => o.textContent)).toEqual([expect.stringContaining('src/server.ts')]);
    expect(options(unstaged).map((o) => o.textContent)).toEqual([expect.stringContaining('README.md')]);
    expect(group(repositoryGroup(view, 'app')!, 'Staged')).toBeNull();
  });

  // plan-multi_repo_workspace/REQ-17
  it('says "No uncommitted changes" inside the group of a clean repository only', () => {
    const { view } = renderStates([loadedState(apiChanges), loadedState([])], [api, app]);
    expect(repositoryGroup(view, 'app')!.textContent).toContain('No uncommitted changes');
    expect(listbox(repositoryGroup(view, 'app')!)).toBeNull();
    expect(repositoryGroup(view, 'api')!.textContent).not.toContain('No uncommitted changes');
  });

  // plan-multi_repo_workspace/REQ-19
  it('shows a git error in the group of its repository only, and the other groups keep their files', () => {
    const { view } = renderStates([loadedState(apiChanges), { status: 'error', message: 'fatal: not a git repository' }], [api, app]);
    const alerts = [...view.querySelectorAll('[role="alert"]')];
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.textContent).toBe('fatal: not a git repository');
    expect(repositoryGroup(view, 'app')!.contains(alerts[0]!)).toBe(true);
    expect(options(repositoryGroup(view, 'api')!)).toHaveLength(2);
  });

  it('shows "Loading…" in the group of a repository with no answer yet', () => {
    const { view } = renderStates([loadedState(apiChanges), { status: 'loading' }], [api, app]);
    expect(repositoryGroup(view, 'app')!.textContent).toContain('Loading…');
    expect(repositoryGroup(view, 'api')!.textContent).not.toContain('Loading…');
  });

  // plan-multi_repo_workspace/REQ-18
  it('loads the diff of a file of the second repository from its root, below all the groups', async () => {
    const { view } = renderStates([loadedState(apiChanges), loadedState(appChanges)], [api, app]);
    flushSync(() => option(repositoryGroup(view, 'app')!, 'README.md')!.click());
    await until(() => fetchMock.mock.calls.length === 1);
    expect(requestedUrl(0).pathname).toBe('/api/git/diff');
    expect(requestedUrl(0).searchParams.get('path')).toBe(app.root);
    expect(requestedUrl(0).searchParams.get('group')).toBe('unstaged');
    expect(requestedUrl(0).searchParams.get('file')).toBe('README.md');
    answer(0, { binary: false, cut: false, lines: [{ kind: 'added', text: 'app line' }] });
    await until(() => view.textContent!.includes('+app line'));
    const diffText = [...view.querySelectorAll('*')].find((el) => el.children.length === 0 && el.textContent?.includes('app line'))!;
    for (const region of repositoryGroups(view)) {
      expect(region.contains(diffText)).toBe(false);
      expect(region.compareDocumentPosition(diffText) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  // plan-multi_repo_workspace/REQ-18: the same path in two repositories are two entries
  it('keeps one selected entry in the whole tab when the same path is clicked in two repositories', async () => {
    const { view } = renderStates([loadedState(apiChanges), loadedState(appChanges)], [api, app]);
    const inApi = option(group(repositoryGroup(view, 'api')!, 'Unstaged')!, 'README.md')!;
    const inApp = option(repositoryGroup(view, 'app')!, 'README.md')!;
    flushSync(() => inApi.click());
    await until(() => fetchMock.mock.calls.length === 1);
    expect(requestedUrl(0).searchParams.get('path')).toBe(api.root);
    expect(selectedOptions(view)).toEqual([inApi]);
    flushSync(() => inApp.click());
    await until(() => fetchMock.mock.calls.length === 2);
    expect(requestedUrl(1).searchParams.get('path')).toBe(app.root);
    await until(() => inApp.getAttribute('aria-selected') === 'true');
    expect(selectedOptions(view)).toEqual([inApp]);
  });
});

describe('ChangesTab with several repositories after a refresh', () => {
  // plan-git_explorer/REQ-26, plan-multi_repo_workspace/REQ-18
  it('keeps the selection when its repository still has the same group and path, and loads its diff again', async () => {
    const { view, update } = renderStates([loadedState(apiChanges), loadedState(appChanges)], [api, app]);
    flushSync(() => option(repositoryGroup(view, 'app')!, 'README.md')!.click());
    await until(() => pending.length === 1);
    answer(0, { binary: false, cut: false, lines: [{ kind: 'added', text: 'old content' }] });
    await until(() => view.textContent!.includes('+old content'));
    update([loadedState(apiChanges.map((e) => ({ ...e }))), loadedState(appChanges.map((e) => ({ ...e })))]);
    const selected = selectedOptions(view);
    expect(selected).toHaveLength(1);
    expect(repositoryGroup(view, 'app')!.contains(selected[0]!)).toBe(true);
    await until(() => pending.length === 2);
    expect(requestedUrl(1).searchParams.get('path')).toBe(app.root);
    answer(1, { binary: false, cut: false, lines: [{ kind: 'added', text: 'new content' }] });
    await until(() => view.textContent!.includes('+new content'));
  });

  it('does not load the diff again when only another repository has a new list', async () => {
    const appState = loadedState(appChanges);
    const { view, update } = renderStates([loadedState(apiChanges), appState], [api, app]);
    flushSync(() => option(repositoryGroup(view, 'app')!, 'README.md')!.click());
    await until(() => pending.length === 1);
    answer(0, { binary: false, cut: false, lines: [{ kind: 'added', text: 'app content' }] });
    await until(() => view.textContent!.includes('+app content'));
    update([loadedState(apiChanges.map((e) => ({ ...e }))), appState]);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(selectedOptions(view)).toHaveLength(1);
    expect(view.textContent).toContain('+app content');
  });

  it('closes the selection and the diff when the path is left only in another repository', async () => {
    const { view, update } = renderStates([loadedState(apiChanges), loadedState(appChanges)], [api, app]);
    flushSync(() => option(repositoryGroup(view, 'app')!, 'README.md')!.click());
    await until(() => pending.length === 1);
    answer(0, { binary: false, cut: false, lines: [{ kind: 'added', text: 'app content' }] });
    await until(() => view.textContent!.includes('+app content'));
    update([loadedState(apiChanges.map((e) => ({ ...e }))), loadedState([])]);
    expect(selectedOptions(view)).toHaveLength(0);
    expect(view.textContent).not.toContain('+app content');
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('closes the selection and the diff when its repository leaves the list', async () => {
    const { view, update } = renderStates([loadedState(apiChanges), loadedState(appChanges), loadedState([])], [api, app, tools]);
    flushSync(() => option(repositoryGroup(view, 'app')!, 'README.md')!.click());
    await until(() => pending.length === 1);
    answer(0, { binary: false, cut: false, lines: [{ kind: 'added', text: 'app content' }] });
    await until(() => view.textContent!.includes('+app content'));
    update([loadedState(apiChanges), loadedState([])], [api, tools]);
    expect(repositoryGroup(view, 'app')).toBeNull();
    expect(selectedOptions(view)).toHaveLength(0);
    expect(view.textContent).not.toContain('+app content');
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
