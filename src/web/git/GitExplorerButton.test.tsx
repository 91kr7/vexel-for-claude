// @vitest-environment jsdom
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GitBranchIcon } from '../icons/Icons';
import { GitExplorerButton } from './GitExplorerButton';
import type { RepositoryLookupState } from './repository-lookup-store';

const repository: RepositoryLookupState = { status: 'repository', root: '/home/dev/project', branch: { kind: 'branch', name: 'main' } };
const error: RepositoryLookupState = { status: 'error', message: 'fatal: bad object HEAD' };

const roots: Root[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  document.body.innerHTML = '';
});

function render(lookup: RepositoryLookupState, open = false, onToggle = () => {}): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  flushSync(() => root.render(<GitExplorerButton lookup={lookup} open={open} onToggle={onToggle} />));
  return container;
}

describe('GitExplorerButton', () => {
  // plan-git_explorer/REQ-2: no button while loading or outside a repository
  it.each<[string, RepositoryLookupState]>([
    ['loading', { status: 'loading' }],
    ['none', { status: 'none' }],
  ])('shows nothing while the lookup is %s', (_name, lookup) => {
    expect(render(lookup).innerHTML).toBe('');
  });

  // plan-git_explorer/REQ-1; with an error the button stays so the panel can show it (REQ-6)
  it.each<[string, RepositoryLookupState]>([
    ['repository', repository],
    ['error', error],
  ])('shows the "Git Explorer" icon button with its tooltip for %s', (_name, lookup) => {
    const button = render(lookup).querySelector('button');
    expect(button).not.toBeNull();
    expect(button!.getAttribute('aria-label') ?? button!.textContent).toBe('Git Explorer');
    expect(button!.getAttribute('title')).toBe('Git Explorer');
    expect(button!.innerHTML).toContain(renderToStaticMarkup(<GitBranchIcon />).match(/<path[^>]*>/)?.[0] ?? '<svg');
  });

  it('follows open with aria-expanded', () => {
    expect(render(repository, false).querySelector('button')!.getAttribute('aria-expanded')).toBe('false');
    expect(render(repository, true).querySelector('button')!.getAttribute('aria-expanded')).toBe('true');
  });

  it('calls onToggle on each click', () => {
    const onToggle = vi.fn();
    const button = render(repository, false, onToggle).querySelector('button')!;
    button.click();
    button.click();
    expect(onToggle).toHaveBeenCalledTimes(2);
  });
});
