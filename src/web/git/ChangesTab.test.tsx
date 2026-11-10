// @vitest-environment jsdom
// Unit tests of ChangesTab (plan-git_explorer, batch uncommitted-changes).
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangesTab } from './ChangesTab';
import type { ChangeEntry } from './changes-store';

const ROOT = '/home/dev/project';
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
  flushSync(() => root.render(<ChangesTab root={ROOT} changes={entries} />));
  return container;
}

const group = (view: HTMLElement, name: string) => view.querySelector<HTMLElement>(`section[aria-label="${name}"]`);
const buttons = (scope: HTMLElement) => [...scope.querySelectorAll<HTMLButtonElement>('button')];
const button = (scope: HTMLElement, text: string) => buttons(scope).find((b) => b.textContent?.includes(text));
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
    expect(buttons(staged!)).toHaveLength(3);
    expect(buttons(unstaged!)).toHaveLength(3);
  });

  // plan-git_explorer/REQ-10: the kind label of each file
  it('labels each file with its kind', () => {
    const view = render();
    const label = (scope: HTMLElement, text: string) => button(scope, text)!.textContent;
    expect(label(group(view, 'Staged')!, 'src/new.ts')).toContain('Added');
    expect(label(group(view, 'Staged')!, 'src/both.ts')).toContain('Modified');
    expect(label(group(view, 'Staged')!, 'new-name.md')).toContain('Renamed');
    expect(label(group(view, 'Unstaged')!, 'gone.txt')).toContain('Deleted');
    expect(label(group(view, 'Unstaged')!, 'notes.txt')).toContain('Untracked');
    expect(label(group(view, 'Unstaged')!, 'src/both.ts')).toContain('Modified');
  });

  it('shows a rename as "<old path> → <new path>", with the full path text as tooltip', () => {
    const rename = button(group(render(), 'Staged')!, 'new-name.md')!;
    expect(rename.textContent).toContain('docs/old-name.md → docs/new-name.md');
    expect(rename.querySelector('[title="docs/old-name.md → docs/new-name.md"]')).not.toBeNull();
  });

  it('gives each path its full text as tooltip', () => {
    const entry = button(group(render(), 'Unstaged')!, 'notes.txt')!;
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
    const staged = button(group(view, 'Staged')!, 'src/both.ts')!;
    const unstaged = button(group(view, 'Unstaged')!, 'src/both.ts')!;
    expect(staged.getAttribute('aria-pressed')).toBe('false');
    flushSync(() => staged.click());
    await until(() => fetchMock.mock.calls.length === 1);
    expect(staged.getAttribute('aria-pressed')).toBe('true');
    expect(unstaged.getAttribute('aria-pressed')).toBe('false');
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
    flushSync(() => button(group(view, 'Staged')!, 'new-name.md')!.click());
    await until(() => fetchMock.mock.calls.length === 1);
    expect(requestedUrl(0).searchParams.get('file')).toBe('docs/new-name.md');
    expect(requestedUrl(0).searchParams.get('oldPath')).toBe('docs/old-name.md');
  });

  it('shows the unstaged diff after a click on the same file in the other group', async () => {
    const view = render();
    flushSync(() => button(group(view, 'Staged')!, 'src/both.ts')!.click());
    await until(() => fetchMock.mock.calls.length === 1);
    flushSync(() => button(group(view, 'Unstaged')!, 'src/both.ts')!.click());
    await until(() => fetchMock.mock.calls.length === 2);
    expect(requestedUrl(1).searchParams.get('group')).toBe('unstaged');
    expect(button(group(view, 'Staged')!, 'src/both.ts')!.getAttribute('aria-pressed')).toBe('false');
    expect(button(group(view, 'Unstaged')!, 'src/both.ts')!.getAttribute('aria-pressed')).toBe('true');
  });

  // plan-git_explorer/REQ-14
  it('shows the binary note for a binary file', async () => {
    const view = render();
    flushSync(() => button(group(view, 'Unstaged')!, 'notes.txt')!.click());
    await until(() => pending.length === 1);
    answer(0, { binary: true, cut: false, lines: [] });
    await until(() => view.textContent!.includes('Binary file, no diff shown'));
  });

  it('shows a diff error in an alert with its message', async () => {
    const view = render();
    flushSync(() => button(group(view, 'Unstaged')!, 'gone.txt')!.click());
    await until(() => pending.length === 1);
    answer(0, { error: 'git_error', message: 'fatal: bad revision' }, 500);
    await until(() => view.querySelector('[role="alert"]') !== null);
    expect(view.querySelector('[role="alert"]')!.textContent).toBe('fatal: bad revision');
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
  flushSync(() => root.render(<ChangesTab root={ROOT} changes={entries} />));
  return { view: container, update: (next: ChangeEntry[]) => flushSync(() => root.render(<ChangesTab root={ROOT} changes={next} />)) };
}

const pressed = (view: HTMLElement) => buttons(view).filter((b) => b.getAttribute('aria-pressed') === 'true');

describe('ChangesTab after a refresh', () => {
  // plan-git_explorer/REQ-26
  it('keeps the entry with the same group and path selected and loads its diff again', async () => {
    const { view, update } = renderUpdatable(changes);
    flushSync(() => button(group(view, 'Unstaged')!, 'src/both.ts')!.click());
    await until(() => pending.length === 1);
    answer(0, { binary: false, cut: false, lines: [{ kind: 'added', text: 'old content' }] });
    await until(() => view.textContent!.includes('+old content'));
    update(changes.map((entry) => ({ ...entry })));
    const selected = pressed(view);
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
    flushSync(() => button(group(view, 'Staged')!, 'src/new.ts')!.click());
    await until(() => pending.length === 1);
    update(changes.map((entry) => (entry.path === 'src/new.ts' ? { ...entry, kind: 'modified' as const } : { ...entry })));
    const selected = pressed(view);
    expect(selected).toHaveLength(1);
    expect(selected[0]!.textContent).toContain('src/new.ts');
    await until(() => pending.length === 2);
  });

  it('closes the selection and the diff when the file is no longer in the same group', async () => {
    const { view, update } = renderUpdatable(changes);
    flushSync(() => button(group(view, 'Staged')!, 'src/both.ts')!.click());
    await until(() => pending.length === 1);
    answer(0, { binary: false, cut: false, lines: [{ kind: 'added', text: 'staged line' }] });
    await until(() => view.textContent!.includes('+staged line'));
    update(changes.filter((entry) => !(entry.group === 'staged' && entry.path === 'src/both.ts')));
    expect(pressed(view)).toHaveLength(0);
    expect(view.textContent).not.toContain('+staged line');
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(view.textContent).not.toContain('Loading…');
  });

  it('keeps the selection closed when the file comes back in a later refresh', async () => {
    const { view, update } = renderUpdatable(changes);
    flushSync(() => button(group(view, 'Unstaged')!, 'notes.txt')!.click());
    await until(() => pending.length === 1);
    update(changes.filter((entry) => entry.path !== 'notes.txt'));
    expect(pressed(view)).toHaveLength(0);
    update(changes.map((entry) => ({ ...entry })));
    expect(pressed(view)).toHaveLength(0);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
