// @vitest-environment jsdom
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { type RepositoryFilter, useRepositoryFilter } from './repository-filter-store';

const A = '/ws/api';
const B = '/ws/tools';
const C = '/ws/web/app';
const ABC = [A, B, C];

let latest: RepositoryFilter;
const roots: Root[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
});

function Probe({ folder, covered }: { folder: string | undefined; covered: readonly string[] }) {
  latest = useRepositoryFilter(folder, covered);
  return null;
}

// The choice is kept per folder for the life of the module, so each test uses its own folder.
let folderCount = 0;
const newFolder = () => `/ws/project-${++folderCount}`;

// flushSync commits the render and its effects at once, also where NODE_ENV=production leaves React without `act`.
function mount(folder: string | undefined, covered: readonly string[]) {
  const root = createRoot(document.createElement('div'));
  roots.push(root);
  flushSync(() => root.render(<Probe folder={folder} covered={covered} />));
  return {
    setRoots: (next: readonly string[]) => flushSync(() => root.render(<Probe folder={folder} covered={next} />)),
    unmount: () => {
      root.unmount();
      roots.splice(roots.indexOf(root), 1);
    },
  };
}
const toggle = (root: string) => flushSync(() => latest.toggle(root));
const clear = () => flushSync(() => latest.clear());
const chosen = () => [...latest.chosen].sort();

describe('useRepositoryFilter', () => {
  // plan-multi_repo_workspace/REQ-30
  it('starts with no filter', () => {
    mount(newFolder(), ABC);
    expect(latest.chosen).toEqual([]);
  });

  // plan-multi_repo_workspace/REQ-28
  it('adds a root on toggle, adds a second one, and removes a chosen one on a second toggle', () => {
    mount(newFolder(), ABC);
    toggle(C);
    expect(chosen()).toEqual([C]);
    toggle(A);
    expect(chosen()).toEqual([A, C]);
    toggle(C);
    expect(chosen()).toEqual([A]);
  });

  // plan-multi_repo_workspace/REQ-30
  it('empties the choice on clear', () => {
    mount(newFolder(), ABC);
    toggle(A);
    toggle(C);
    clear();
    expect(latest.chosen).toEqual([]);
  });

  // plan-multi_repo_workspace/REQ-28: the choice lasts while the page stays open
  it('gives a later mount on the same folder the same choice', () => {
    const folder = newFolder();
    const first = mount(folder, ABC);
    toggle(C);
    first.unmount();
    mount(folder, ABC);
    expect(chosen()).toEqual([C]);
  });

  it('keeps the choice of each folder apart', () => {
    const folder = newFolder();
    mount(folder, ABC);
    toggle(B);
    mount(newFolder(), ABC);
    expect(latest.chosen).toEqual([]);
  });

  it('shares the choice of a folder between two mounts at the same time', () => {
    const folder = newFolder();
    mount(folder, ABC);
    toggle(A);
    mount(folder, ABC);
    expect(chosen()).toEqual([A]);
  });

  it('keeps the choice only in the calling component without a folder', () => {
    const first = mount(undefined, ABC);
    toggle(A);
    expect(chosen()).toEqual([A]);
    first.unmount();
    mount(undefined, ABC);
    expect(latest.chosen).toEqual([]);
  });

  // plan-multi_repo_workspace/REQ-28 (Filter life): a removed repository leaves the filter
  it('drops a root that the covered roots no longer hold, also when it comes back later', () => {
    const folder = newFolder();
    const view = mount(folder, ABC);
    toggle(A);
    toggle(C);
    view.setRoots([A, B]);
    expect(chosen()).toEqual([A]);
    view.setRoots(ABC);
    expect(chosen()).toEqual([A]);
  });

  it('drops a removed root also for a later mount', () => {
    const folder = newFolder();
    const view = mount(folder, ABC);
    toggle(A);
    toggle(C);
    view.setRoots([A, B]);
    view.unmount();
    mount(folder, ABC);
    expect(chosen()).toEqual([A]);
  });

  // plan-multi_repo_workspace/REQ-30 (Filter life): a filter left with no repository counts as no filter
  it('has no filter once every chosen root is gone', () => {
    const folder = newFolder();
    const view = mount(folder, ABC);
    toggle(C);
    view.setRoots([A, B]);
    expect(latest.chosen).toEqual([]);
    view.setRoots(ABC);
    expect(latest.chosen).toEqual([]);
  });

  it('keeps the choice as it is while the covered roots are empty', () => {
    const folder = newFolder();
    const view = mount(folder, ABC);
    toggle(B);
    view.setRoots([]);
    view.setRoots(ABC);
    expect(chosen()).toEqual([B]);
  });

  it('keeps the choice for a later mount that starts before the lookup answers', () => {
    const folder = newFolder();
    const first = mount(folder, ABC);
    toggle(B);
    first.unmount();
    const second = mount(folder, []);
    second.setRoots(ABC);
    expect(chosen()).toEqual([B]);
  });

  // plan-multi_repo_workspace/REQ-31
  it('has no filter with a single covered root, also after a toggle', () => {
    mount(newFolder(), [A]);
    expect(latest.chosen).toEqual([]);
    toggle(A);
    expect(latest.chosen).toEqual([]);
  });

  it('has no filter once the covered roots shrink to one', () => {
    const view = mount(newFolder(), ABC);
    toggle(A);
    view.setRoots([A]);
    expect(latest.chosen).toEqual([]);
  });
});
