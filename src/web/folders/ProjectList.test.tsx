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
function mount(store: ProjectListStore) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  flushSync(() => root.render(<ProjectList store={store} />));
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
});
