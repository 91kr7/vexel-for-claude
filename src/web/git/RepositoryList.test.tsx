// @vitest-environment jsdom
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BranchChip, RepositoryList } from './RepositoryList';
import { repositoryColor } from './repository-colors';
import type { BranchInfo, CoveredRepository } from './repository-lookup-store';

const roots: Root[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  document.body.innerHTML = '';
});

function render(node: ReactNode): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  flushSync(() => root.render(node));
  return container;
}

const repositories: CoveredRepository[] = [
  { root: '/home/dev', name: 'dev', path: '..', branch: { kind: 'branch', name: 'main' } },
  { root: '/home/dev/ws/api', name: 'api', path: 'api', branch: { kind: 'branch', name: 'feature/list' } },
  { root: '/home/dev/ws/web/app', name: 'app', path: 'web/app', branch: { kind: 'detached', hash: 'a1b2c3d' } },
  { root: '/home/dev/ws/broken', name: 'broken', path: 'broken', error: 'fatal: not a git repository' },
];

const list = (container: HTMLElement) => container.querySelector<HTMLElement>('[aria-label="Repositories"]')!;
/** The toggle button of each entry. */
const entries = (container: HTMLElement) => [...list(container).querySelectorAll<HTMLElement>('li')].map((li) => li.querySelector<HTMLElement>('button')!);
const allButton = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent?.trim() === 'All repositories');
const noop = () => {};
/** Renders the list with no filter unless `chosen` is given. */
const renderList = (items: CoveredRepository[], chosen: string[] = [], onToggle = noop, onClear = noop) =>
  render(<RepositoryList repositories={items} chosen={chosen} onToggle={onToggle} onClear={onClear} />);
/** The colour mark of an entry: the element with an inline background colour. */
const mark = (entry: HTMLElement) => [...entry.querySelectorAll<HTMLElement>('*')].find((el) => el.style.backgroundColor !== '');
/** Whether `text` is the whole text of one element of `entry`. */
const hasPart = (entry: HTMLElement, text: string) => [...entry.querySelectorAll('*')].some((el) => el.textContent?.trim() === text);

describe('RepositoryList', () => {
  // plan-multi_repo_workspace/REQ-7, REQ-8
  it('is a list named "Repositories" with one entry per repository, in the given order, with the root as tooltip', () => {
    const container = renderList(repositories);
    expect(list(container)).not.toBeNull();
    expect(entries(container).map((e) => e.getAttribute('title'))).toEqual(repositories.map((r) => r.root));
  });

  // plan-multi_repo_workspace/REQ-7
  it('shows the name, the relative path and the branch chip of each entry', () => {
    const [above, api, app] = entries(renderList(repositories));
    expect(hasPart(above!, 'dev')).toBe(true);
    expect(hasPart(above!, '..')).toBe(true);
    expect(hasPart(above!, 'main')).toBe(true);
    expect(hasPart(api!, 'api')).toBe(true);
    expect(hasPart(api!, 'feature/list')).toBe(true);
    expect(hasPart(app!, 'app')).toBe(true);
    expect(hasPart(app!, 'web/app')).toBe(true);
    expect(hasPart(app!, 'detached a1b2c3d')).toBe(true);
    expect(api!.querySelector('svg'), 'the git-branch icon of the chip').not.toBeNull();
  });

  // plan-multi_repo_workspace/REQ-7: colour by position in the list
  it('gives each entry the colour of its position', () => {
    const container = renderList(repositories);
    const expected = repositories.map((_r, i) => {
      const probe = document.createElement('span');
      probe.style.backgroundColor = repositoryColor(i);
      return probe.style.backgroundColor;
    });
    expect(entries(container).map((e) => mark(e)?.style.backgroundColor)).toEqual(expected);
  });

  it('starts the palette again after the sixth entry', () => {
    const many: CoveredRepository[] = Array.from({ length: 7 }, (_v, i) => ({ root: `/ws/r${i}`, name: `r${i}`, path: `r${i}`, branch: { kind: 'branch', name: 'main' } }));
    const marks = entries(renderList(many)).map((e) => mark(e)?.style.backgroundColor);
    expect(marks[6]).toBe(marks[0]);
    expect(new Set(marks.slice(0, 6)).size).toBe(6);
  });

  // plan-multi_repo_workspace/REQ-9
  it('shows the git message in place of the branch chip on an entry with an error, and the other entries still show', () => {
    const container = renderList(repositories);
    const broken = entries(container)[3]!;
    expect(hasPart(broken, 'fatal: not a git repository')).toBe(true);
    expect(broken.querySelector('svg'), 'no branch chip').toBeNull();
    expect(entries(container)).toHaveLength(4);
    expect(hasPart(entries(container)[0]!, 'main')).toBe(true);
  });
});

describe('RepositoryList filter', () => {
  // plan-multi_repo_workspace/REQ-30
  it('shows "All repositories" pressed and no entry pressed with no filter', () => {
    const container = renderList(repositories);
    const all = allButton(container);
    expect(all, 'a button "All repositories"').toBeDefined();
    expect(all!.getAttribute('aria-pressed')).toBe('true');
    expect(entries(container).map((e) => e.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false', 'false']);
  });

  it('places "All repositories" above the list', () => {
    const container = renderList(repositories);
    expect(allButton(container)!.compareDocumentPosition(list(container)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // plan-multi_repo_workspace/REQ-28
  it('presses the chosen entries and releases "All repositories"', () => {
    const container = renderList(repositories, ['/home/dev/ws/api', '/home/dev/ws/web/app']);
    expect(allButton(container)!.getAttribute('aria-pressed')).toBe('false');
    expect(entries(container).map((e) => e.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'true', 'false']);
  });

  // plan-multi_repo_workspace/REQ-28
  it('calls onToggle with the root of the clicked entry', () => {
    const onToggle = vi.fn();
    const container = renderList(repositories, [], onToggle);
    flushSync(() => entries(container)[2]!.click());
    expect(onToggle).toHaveBeenCalledExactlyOnceWith('/home/dev/ws/web/app');
  });

  it('calls onToggle also for a chosen entry and for an entry with an error', () => {
    const onToggle = vi.fn();
    const container = renderList(repositories, ['/home/dev/ws/api'], onToggle);
    flushSync(() => entries(container)[1]!.click());
    flushSync(() => entries(container)[3]!.click());
    expect(onToggle.mock.calls).toEqual([['/home/dev/ws/api'], ['/home/dev/ws/broken']]);
  });

  // plan-multi_repo_workspace/REQ-30
  it('calls onClear on "All repositories"', () => {
    const onClear = vi.fn();
    const onToggle = vi.fn();
    const container = renderList(repositories, ['/home/dev/ws/api'], onToggle, onClear);
    flushSync(() => allButton(container)!.click());
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe('BranchChip', () => {
  it.each<[string, BranchInfo, string]>([
    ['a branch', { kind: 'branch', name: 'main' }, 'main'],
    ['a detached HEAD', { kind: 'detached', hash: 'a1b2c3d' }, 'detached a1b2c3d'],
  ])('shows the icon and the text of %s', (_name, branch, text) => {
    const container = render(<BranchChip branch={branch} className="probe" />);
    expect(container.textContent).toBe(text);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('.probe')).not.toBeNull();
  });
});
