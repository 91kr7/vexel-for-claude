// @vitest-environment jsdom
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FolderIcon } from '../icons/Icons';
import { ProjectList } from './ProjectList';
import { ProjectListStore } from './project-list-store';

const roots: Root[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  document.body.innerHTML = '';
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const session = (lastActivity: string) => ({ id: `id-${lastActivity}`, label: 'Label', lastActivity, runningElsewhere: false });

const groups = [
  { folder: '/home/u/web-dashboard', available: true, sessions: [session('2026-11-10T10:00:00.000Z')] },
  { folder: '/home/u/old-api', available: false, sessions: [session('2026-11-09T10:00:00.000Z')] },
];

/** A store whose loads wait for the test to answer them. */
function controlledStore() {
  const answers: { resolve: (body: unknown) => void; reject: (error: unknown) => void }[] = [];
  const fetchGroups = vi.fn(
    () =>
      new Promise((resolve, reject) => {
        answers.push({ resolve, reject });
      }),
  );
  return { store: new ProjectListStore(fetchGroups as never), answers, fetchGroups };
}

async function storeWith(body: unknown | Error) {
  const controlled = controlledStore();
  controlled.store.load();
  if (body instanceof Error) controlled.answers[0]!.reject(body);
  else controlled.answers[0]!.resolve(body);
  await settle();
  return controlled;
}

// The shell may export NODE_ENV=production, where React has no `act`: flushSync commits the render at once.
function mount(store: ProjectListStore, onChoose?: (project: unknown) => void) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  flushSync(() => root.render(<ProjectList store={store} onChoose={onChoose} />));
  return host;
}

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const rows = (host: HTMLElement) => [...host.querySelectorAll<HTMLButtonElement>('button.project-row')];

describe('ProjectList', () => {
  // ProjectList "Shows": the title row with the h1 "Projects" in .section-label
  it('shows the title "Projects" as an h1 in .section-label inside .list-panel-title', () => {
    const host = mount(controlledStore().store);
    const title = host.querySelector('.list-panel-title h1.section-label');
    expect(text(title)).toBe('Projects');
  });

  it('starts no load when it is shown', async () => {
    const { store, fetchGroups } = controlledStore();
    mount(store);
    await settle();
    expect(fetchGroups).not.toHaveBeenCalled();
  });

  it('shows "Loading…" and no row in the loading state', () => {
    const host = mount(controlledStore().store);
    expect(text(host)).toContain('Loading…');
    expect(rows(host)).toHaveLength(0);
  });

  it('shows "Could not load the projects." when the first load fails', async () => {
    const { store } = await storeWith(new Error('down'));
    const host = mount(store);
    expect(text(host)).toContain('Could not load the projects.');
    expect(rows(host)).toHaveLength(0);
  });

  // plan-recent_projects/REQ-9
  it('shows the empty state "No projects yet" with the folder icon when there is no project', async () => {
    const { store } = await storeWith([]);
    const host = mount(store);
    expect(text(host)).toContain('No projects yet');
    expect(rows(host)).toHaveLength(0);
    expect(host.innerHTML).toContain(renderToStaticMarkup(<FolderIcon />));
  });

  // plan-recent_projects/REQ-6, REQ-7: one row per project in the store order, with name, path and last activity
  it('shows one button row per project, in order, with the folder name, the full path and "Last activity"', async () => {
    const { store } = await storeWith(groups);
    const host = mount(store);
    const list = rows(host);
    expect(list).toHaveLength(2);
    expect(list.map((row) => row.getAttribute('type') ?? 'submit')).toEqual(['button', 'button']);
    const [first] = list;
    expect(text(first)).toContain('web-dashboard');
    expect(text(first)).toContain('/home/u/web-dashboard');
    expect(text(first)).toContain('Last activity');
    expect(first!.querySelector('[title="/home/u/web-dashboard"]')).not.toBeNull();
    expect(first!.querySelector('time')?.getAttribute('datetime')).toBe('2026-11-10T10:00:00.000Z');
    expect(text(list[1])).toContain('old-api');
    expect(list[1]!.querySelector('time')?.getAttribute('datetime')).toBe('2026-11-09T10:00:00.000Z');
  });

  // plan-recent_projects/REQ-10: an unavailable row stays, marked
  it('marks an unavailable row aria-disabled with "Folder not found" before "Last activity"', async () => {
    const { store } = await storeWith(groups);
    const [available, unavailable] = rows(mount(store));
    expect(unavailable!.getAttribute('aria-disabled')).toBe('true');
    const content = text(unavailable);
    expect(content).toContain('Folder not found');
    expect(content.indexOf('Folder not found')).toBeLessThan(content.indexOf('Last activity'));
    expect(available!.getAttribute('aria-disabled')).not.toBe('true');
    expect(text(available)).not.toContain('Folder not found');
  });

  // plan-recent_projects/REQ-11: Tab reaches every row, unavailable rows included
  it('keeps every row focusable, unavailable rows included', async () => {
    const { store } = await storeWith(groups);
    for (const row of rows(mount(store))) {
      expect(row.disabled).toBe(false);
      expect(row.tabIndex).toBeGreaterThanOrEqual(0);
      row.focus();
      expect(document.activeElement).toBe(row);
    }
  });

  it('does nothing on a click on a row', async () => {
    const { store, fetchGroups } = await storeWith(groups);
    const host = mount(store);
    const before = store.getSnapshot();
    const html = host.innerHTML;
    for (const row of rows(host)) flushSync(() => row.click());
    expect(fetchGroups).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(before);
    expect(host.innerHTML).toBe(html);
  });

  // plan-recent_projects/REQ-12: the rows stay while a new load runs, and change when the store gives a new list
  it('keeps its rows while a new load runs, then shows the new list', async () => {
    const { store, answers } = await storeWith(groups);
    const host = mount(store);
    flushSync(() => store.load());
    expect(rows(host).map(text)).toHaveLength(2);
    expect(text(host)).not.toContain('Loading…');
    answers[1]!.resolve([groups[1]]);
    await settle();
    flushSync(() => {});
    expect(rows(host)).toHaveLength(1);
    expect(text(rows(host)[0])).toContain('old-api');
  });

  it('renders again when the store goes from loading to ready', async () => {
    const { store, answers } = controlledStore();
    const host = mount(store);
    store.load();
    answers[0]!.resolve(groups);
    await settle();
    flushSync(() => {});
    expect(rows(host)).toHaveLength(2);
  });

  // plan-recent_projects/REQ-14, REQ-15: a click on an available row chooses its project; an unavailable row calls nothing
  it('calls onChoose with the project of a clicked available row, and nothing for an unavailable row', async () => {
    const { store } = await storeWith(groups);
    const onChoose = vi.fn();
    const [available, unavailable] = rows(mount(store, onChoose));
    flushSync(() => unavailable!.click());
    expect(onChoose).not.toHaveBeenCalled();
    flushSync(() => available!.click());
    expect(onChoose).toHaveBeenCalledOnce();
    expect(onChoose.mock.calls[0]![0]).toMatchObject({ folder: '/home/u/web-dashboard', available: true, lastActivity: '2026-11-10T10:00:00.000Z' });
  });

  // ProjectList "Shows": the decorative "▶ New session" label only on available rows, outside the row name
  it('gives only available rows the decorative "▶ New session" label, hidden from the row name', async () => {
    const { store } = await storeWith(groups);
    const [available, unavailable] = rows(mount(store, vi.fn()));
    const label = [...available!.querySelectorAll('*')].find((el) => el.children.length === 0 && text(el).includes('New session'));
    expect(text(label)).toBe('▶ New session');
    expect(label!.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(text(unavailable)).not.toContain('New session');
  });
});

/** A store with the given project marks. */
async function markedStore(favorites: string[]) {
  const marks = { subscribe: () => () => {}, getSnapshot: () => ({ favorites: new Set(favorites) as ReadonlySet<string> }) };
  const store = new ProjectListStore(async () => groups as never, marks);
  store.load();
  await settle();
  return store;
}

const rowOf = (host: HTMLElement, folder: string) => rows(host).find((row) => row.querySelector(`[title="${folder}"]`))!;
const favoriteButtons = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLButtonElement>('button')].filter((b) => /^(Mark as Favorite|Remove Favorite)$/.test(b.getAttribute('aria-label') ?? b.textContent?.trim() ?? ''));
const nameOf = (button: HTMLButtonElement) => button.getAttribute('aria-label') ?? button.textContent?.trim();

describe('ProjectList favorite mark', () => {
  // plan-project_list_actions/REQ-24, REQ-30: the star of a favorite row, told apart by shape and name
  it('shows the FavoriteIndicator after the folder name of a favorite row only', async () => {
    const host = mount(await markedStore(['/home/u/old-api']));
    const favorite = rowOf(host, '/home/u/old-api');
    const indicator = favorite.querySelector('[role="img"][aria-label="Favorite"]');
    expect(indicator).not.toBeNull();
    expect(indicator!.getAttribute('title')).toBe('Favorite');
    expect(indicator!.querySelector('svg.icon-filled')).not.toBeNull();
    const name = [...favorite.querySelectorAll('*')].find((el) => el.children.length === 0 && el.textContent === 'old-api');
    expect(name).toBeDefined();
    expect(name!.compareDocumentPosition(indicator!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rowOf(host, '/home/u/web-dashboard').querySelector('[aria-label="Favorite"]')).toBeNull();
  });

  // plan-project_list_actions/REQ-25
  it('shows the favorite row first, in the store order', async () => {
    const host = mount(await markedStore(['/home/u/old-api']));
    expect(rows(host).map((row) => row.querySelector('[title^="/"]')?.getAttribute('title'))).toEqual(['/home/u/old-api', '/home/u/web-dashboard']);
  });

  // plan-project_list_actions/REQ-23, REQ-27, REQ-31: each row, unavailable too, has its button beside the row button
  it('gives every row a favorite button beside the row button, not inside it, right after it in the tab order', async () => {
    const host = mount(await markedStore(['/home/u/web-dashboard']));
    const buttons = favoriteButtons(host);
    expect(buttons).toHaveLength(2);
    for (const button of buttons) expect(button.closest('.project-row')).toBeNull();
    const focusable = [...host.querySelectorAll<HTMLButtonElement>('button')].filter((b) => b.tabIndex >= 0);
    const order = focusable.map((b) => (b.classList.contains('project-row') ? b.querySelector('[title^="/"]')?.getAttribute('title') : nameOf(b)));
    expect(order).toEqual(['/home/u/web-dashboard', 'Remove Favorite', 'Remove from Projects', '/home/u/old-api', 'Mark as Favorite', 'Remove from Projects']);
  });

  it('keeps the favorite button of an unavailable row enabled', async () => {
    const host = mount(await markedStore([]));
    const unavailableButton = favoriteButtons(host)[1]!;
    expect(rowOf(host, '/home/u/old-api').getAttribute('aria-disabled')).toBe('true');
    expect(unavailableButton.disabled).toBe(false);
    expect(unavailableButton.getAttribute('aria-disabled')).not.toBe('true');
  });

  it('a press on the favorite button does not choose the project', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const onChoose = vi.fn();
    const host = mount(await markedStore([]), onChoose);
    favoriteButtons(host)[0]!.click();
    expect(onChoose).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

const removeButtons = (host: HTMLElement) => [...host.querySelectorAll<HTMLButtonElement>('button')].filter((b) => nameOf(b) === 'Remove from Projects');

const threeGroups = [
  { folder: '/home/u/alpha', available: true, sessions: [session('2026-11-10T10:00:00.000Z')] },
  { folder: '/home/u/bravo', available: false, sessions: [session('2026-11-09T10:00:00.000Z')] },
  { folder: '/home/u/charlie', available: true, sessions: [session('2026-11-08T10:00:00.000Z')] },
];
const REMOVED_AT = '2026-11-12T08:00:00.000Z';

/** A store on threeGroups whose removals the test sets. */
async function removableStore() {
  const listeners = new Set<() => void>();
  let snapshot = { favorites: new Set<string>() as ReadonlySet<string>, removed: new Map<string, string>() as ReadonlyMap<string, string> };
  const marks = {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
  };
  const store = new ProjectListStore(async () => threeGroups as never, marks);
  store.load();
  await settle();
  const remove = async (...folders: string[]) => {
    snapshot = { favorites: snapshot.favorites, removed: new Map([...snapshot.removed, ...folders.map((f) => [f, REMOVED_AT] as [string, string])]) };
    for (const listener of listeners) listener();
    await settle();
  };
  return { store, remove };
}

const shown = (host: HTMLElement) => rows(host).map((row) => row.querySelector('[title^="/"]')?.getAttribute('title'));

describe('ProjectList remove action', () => {
  // plan-project_list_actions/REQ-12, REQ-18, REQ-21: each row, unavailable too, has its remove button beside the row button
  it('gives every row a remove button beside the row button, not inside it, enabled also on an unavailable row', async () => {
    const { store } = await removableStore();
    const host = mount(store);
    const buttons = removeButtons(host);
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      expect(button.closest('.project-row')).toBeNull();
      expect(button.disabled).toBe(false);
      expect(button.getAttribute('aria-disabled')).not.toBe('true');
    }
    expect(rowOf(host, '/home/u/bravo').getAttribute('aria-disabled')).toBe('true');
  });

  it('a press on the remove button does not choose the project', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const onChoose = vi.fn();
    const { store } = await removableStore();
    const host = mount(store, onChoose);
    removeButtons(host)[0]!.click();
    expect(onChoose).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  // ProjectRemoveButton rule: the button does not hide the row by itself; the row leaves through the marks
  it('after a 204 the row stays until the marks hold the removal, then it leaves at once', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
    const { store, remove } = await removableStore();
    const host = mount(store);
    removeButtons(host)[1]!.click();
    await settle();
    expect(shown(host)).toEqual(['/home/u/alpha', '/home/u/bravo', '/home/u/charlie']);
    await remove('/home/u/bravo');
    expect(shown(host)).toEqual(['/home/u/alpha', '/home/u/charlie']);
    vi.unstubAllGlobals();
  });

  // plan-project_list_actions/REQ-21: the focus goes to the next row still in the list
  it('when the row holding the focus leaves, the focus goes to the row button of the next row', async () => {
    const { store, remove } = await removableStore();
    const host = mount(store);
    removeButtons(host)[1]!.focus();
    expect(document.activeElement).toBe(removeButtons(host)[1]);
    await remove('/home/u/bravo');
    expect(document.activeElement).toBe(rowOf(host, '/home/u/charlie'));
  });

  it('when the row button itself held the focus, the focus goes to the next row too', async () => {
    const { store, remove } = await removableStore();
    const host = mount(store);
    rowOf(host, '/home/u/alpha').focus();
    await remove('/home/u/alpha');
    expect(document.activeElement).toBe(rowOf(host, '/home/u/bravo'));
  });

  it('when the last row holding the focus leaves, the focus goes to the previous row', async () => {
    const { store, remove } = await removableStore();
    const host = mount(store);
    removeButtons(host)[2]!.focus();
    await remove('/home/u/charlie');
    expect(document.activeElement).toBe(rowOf(host, '/home/u/bravo'));
  });

  it('skips the rows that leave together: the focus goes to the next row still in the list', async () => {
    const { store, remove } = await removableStore();
    const host = mount(store);
    removeButtons(host)[0]!.focus();
    await remove('/home/u/alpha', '/home/u/bravo');
    expect(document.activeElement).toBe(rowOf(host, '/home/u/charlie'));
  });

  it('does not move the focus when no row is left', async () => {
    const { store, remove } = await removableStore();
    const host = mount(store);
    removeButtons(host)[0]!.focus();
    await remove('/home/u/alpha', '/home/u/bravo', '/home/u/charlie');
    expect(rows(host)).toHaveLength(0);
    expect(host.contains(document.activeElement)).toBe(false);
  });

  it('does not move the focus when it is on another element', async () => {
    const { store, remove } = await removableStore();
    const host = mount(store);
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    await remove('/home/u/bravo');
    expect(document.activeElement).toBe(outside);

    rowOf(host, '/home/u/alpha').focus();
    await remove('/home/u/charlie');
    expect(document.activeElement).toBe(rowOf(host, '/home/u/alpha'));
  });
});

const searchField = (host: HTMLElement) => host.querySelector<HTMLInputElement>('input[aria-label="Search projects"]');
const clearButton = (host: HTMLElement) => [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => nameOf(b) === 'Clear Search');

/** Types a whole new text in the search field, as one change of its value. */
function type(host: HTMLElement, value: string) {
  const field = searchField(host)!;
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  flushSync(() => {
    setValue.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const searchGroups = [
  { folder: '/home/dev/work/Vexel-Client', available: true, sessions: [session('2026-11-10T10:00:00.000Z')] },
  { folder: '/home/dev/app', available: true, sessions: [session('2026-11-09T10:00:00.000Z')] },
  { folder: '/home/dev/apex', available: false, sessions: [session('2026-11-08T10:00:00.000Z')] },
  { folder: '/home/dev/api', available: true, sessions: [session('2026-11-07T10:00:00.000Z')] },
  { folder: '/srv/vexel-docs', available: true, sessions: [session('2026-11-06T10:00:00.000Z')] },
];

/** A store on searchGroups with the given favorites, and the spy of its loads. */
async function searchStore(favorites: string[] = []) {
  const marks = { subscribe: () => () => {}, getSnapshot: () => ({ favorites: new Set(favorites) as ReadonlySet<string> }) };
  const fetchGroups = vi.fn(async () => searchGroups as never);
  const store = new ProjectListStore(fetchGroups, marks);
  store.load();
  await settle();
  return { store, fetchGroups };
}

describe('ProjectList search', () => {
  // plan-project_list_actions/REQ-1, REQ-11: the bar sits between the title and the rows, empty at mount, in English
  it('shows the field "Search projects", empty, between the title and the rows, with no "Clear Search"', async () => {
    const { store } = await searchStore();
    const host = mount(store);
    const field = searchField(host);
    expect(field).not.toBeNull();
    expect(field!.value).toBe('');
    expect(field!.placeholder).toBe('Search projects');
    expect(clearButton(host)).toBeUndefined();
    const title = host.querySelector('.list-panel-title')!;
    expect(title.compareDocumentPosition(field!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(field!.compareDocumentPosition(rows(host)[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows no search bar while loading, on error, or with no project', async () => {
    expect(searchField(mount(controlledStore().store))).toBeNull();
    expect(searchField(mount((await storeWith(new Error('down'))).store))).toBeNull();
    const host = mount((await storeWith([])).store);
    expect(text(host)).toContain('No projects yet');
    expect(searchField(host)).toBeNull();
  });

  // plan-project_list_actions/REQ-2: anywhere in the full path, any case
  it('shows only the rows whose full path contains the text, ignoring case', async () => {
    const { store } = await searchStore();
    const host = mount(store);
    type(host, 'VEXEL');
    expect(shown(host)).toEqual(['/home/dev/work/Vexel-Client', '/srv/vexel-docs']);
    type(host, 'work/vE');
    expect(shown(host)).toEqual(['/home/dev/work/Vexel-Client']);
    type(host, '/SRV/');
    expect(shown(host)).toEqual(['/srv/vexel-docs']);
  });

  // plan-project_list_actions/REQ-3: each change of the text updates the rows, with no request
  it('updates the rows at each change of the text and sends no load', async () => {
    const { store, fetchGroups } = await searchStore();
    const host = mount(store);
    const counts = ['a', 'ap', 'api'].map((value) => {
      type(host, value);
      return shown(host);
    });
    expect(counts).toEqual([
      ['/home/dev/app', '/home/dev/apex', '/home/dev/api'],
      ['/home/dev/app', '/home/dev/apex', '/home/dev/api'],
      ['/home/dev/api'],
    ]);
    type(host, '');
    expect(shown(host)).toHaveLength(5);
    await settle();
    expect(fetchGroups).toHaveBeenCalledTimes(1);
  });

  // plan-project_list_actions/REQ-4: the filtered rows keep the full list order, favorites first
  it('keeps the store order in the filtered list, the favorite first', async () => {
    const { store } = await searchStore(['/home/dev/api']);
    const host = mount(store);
    expect(shown(host)[0]).toBe('/home/dev/api');
    type(host, 'ap');
    expect(shown(host)).toEqual(['/home/dev/api', '/home/dev/app', '/home/dev/apex']);
    expect(rowOf(host, '/home/dev/api').querySelector('[aria-label="Favorite"]')).not.toBeNull();
  });

  // plan-project_list_actions/REQ-5: no match gives the empty state with the text in quotes; the bar stays
  it('shows the empty state No projects match "<text>" with the folder icon, and keeps the search bar', async () => {
    const { store } = await searchStore();
    const host = mount(store);
    type(host, 'zzz');
    expect(rows(host)).toHaveLength(0);
    expect(text(host)).toContain('No projects match "zzz"');
    expect(text(host)).not.toContain('No projects yet');
    expect(host.innerHTML).toContain(renderToStaticMarkup(<FolderIcon />));
    expect(searchField(host)!.value).toBe('zzz');
    expect(clearButton(host)).toBeDefined();
  });

  // plan-project_list_actions/REQ-6: "Clear Search" empties the text, shows every row, focuses the field
  it('"Clear Search" shows while the text is not empty; a press empties it, shows every row and focuses the field', async () => {
    const { store } = await searchStore();
    const host = mount(store);
    type(host, 'vexel-c');
    expect(shown(host)).toHaveLength(1);
    const clear = clearButton(host)!;
    expect(clear.getAttribute('title')).toBe('Clear Search');
    clear.focus();
    flushSync(() => clear.click());
    expect(searchField(host)!.value).toBe('');
    expect(shown(host)).toHaveLength(5);
    expect(document.activeElement).toBe(searchField(host));
    expect(clearButton(host)).toBeUndefined();
  });

  // plan-project_list_actions/REQ-9: Tab reaches the field, then "Clear Search", then the rows
  it('puts the field, then "Clear Search", before the first row in the tab order', async () => {
    const { store } = await searchStore();
    const host = mount(store);
    type(host, 'dev');
    const focusable = [...host.querySelectorAll<HTMLElement>('input, button')].filter((el) => el.tabIndex >= 0);
    expect(focusable[0]).toBe(searchField(host));
    expect(focusable[1]).toBe(clearButton(host));
    expect(focusable[2]).toBe(rows(host)[0]);
  });

  // plan-project_list_actions/REQ-8: a filtered row chooses its project as in the full list
  it('calls onChoose with the project of a row chosen in a filtered list, and nothing for an unavailable one', async () => {
    const { store } = await searchStore();
    const onChoose = vi.fn();
    const host = mount(store, onChoose);
    type(host, 'ap');
    flushSync(() => rowOf(host, '/home/dev/apex').click());
    expect(onChoose).not.toHaveBeenCalled();
    flushSync(() => rowOf(host, '/home/dev/app').click());
    expect(onChoose).toHaveBeenCalledOnce();
    expect(onChoose.mock.calls[0]![0]).toMatchObject({ folder: '/home/dev/app', available: true });
  });

  // ProjectList rule: the search text stays while the store gives a new list
  it('keeps the search text and filters the new list the store gives', async () => {
    const answers: ((body: unknown) => void)[] = [];
    const store = new ProjectListStore((() => new Promise((resolve) => answers.push(resolve))) as never);
    store.load();
    answers[0]!(searchGroups);
    await settle();
    const host = mount(store);
    type(host, 'vexel');
    expect(shown(host)).toHaveLength(2);
    flushSync(() => store.load());
    answers[1]!([...searchGroups, { folder: '/opt/VEXEL', available: true, sessions: [session('2026-11-05T10:00:00.000Z')] }]);
    await settle();
    flushSync(() => {});
    expect(searchField(host)!.value).toBe('vexel');
    expect(shown(host)).toEqual(['/home/dev/work/Vexel-Client', '/srv/vexel-docs', '/opt/VEXEL']);
  });

  // ProjectList "Actions": the focus is not moved when a row leaves while the focus is on the search field
  it('does not move the focus from the search field when a row leaves', async () => {
    const { store, remove } = await removableStore();
    const host = mount(store);
    type(host, 'a');
    searchField(host)!.focus();
    await remove('/home/u/alpha');
    expect(document.activeElement).toBe(searchField(host));
    expect(shown(host)).toEqual(['/home/u/bravo', '/home/u/charlie']);
  });
});
