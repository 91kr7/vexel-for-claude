// @vitest-environment jsdom
// Unit tests of DiffView (plan-git_explorer, batch uncommitted-changes). Colours and font are checked in e2e/git-explorer.spec.ts.
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { DiffView } from './DiffView';
import type { FileDiff } from './diff-store';

const roots: Root[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  document.body.innerHTML = '';
});

function render(diff: FileDiff): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  flushSync(() => root.render(<DiffView diff={diff} />));
  return container;
}

describe('DiffView', () => {
  // plan-git_explorer/REQ-12
  it('shows "+" before added lines, "-" before removed lines, a space before context lines and the hunk text as it is', () => {
    const view = render({
      binary: false,
      cut: false,
      lines: [
        { kind: 'hunk', text: '@@ -1,2 +1,2 @@' },
        { kind: 'context', text: 'keep' },
        { kind: 'removed', text: 'old' },
        { kind: 'added', text: 'new' },
      ],
    });
    expect(view.textContent).toBe('@@ -1,2 +1,2 @@ keep-old+new');
    expect(view.textContent).not.toContain('Binary file');
    expect(view.textContent).not.toContain('Diff cut');
  });

  // plan-git_explorer/REQ-14
  it('shows only the note "Binary file, no diff shown" for a binary file', () => {
    expect(render({ binary: true, cut: false, lines: [] }).textContent).toBe('Binary file, no diff shown');
  });

  // plan-git_explorer/REQ-15
  it('shows the note "Diff cut at 5,000 lines" after the lines of a cut diff', () => {
    const text = render({ binary: false, cut: true, lines: [{ kind: 'added', text: 'first' }] }).textContent ?? '';
    expect(text).toContain('+first');
    expect(text.indexOf('Diff cut at 5,000 lines')).toBeGreaterThan(text.indexOf('+first'));
  });

  // plan-git_graph/REQ-2: one table row per line, the hunk header in a row of its own, no line-number gutter
  it('draws one table row per line, with the hunk header in a row of its own and no gutter', () => {
    const view = render({
      binary: false,
      cut: false,
      lines: [
        { kind: 'hunk', text: '@@ -1,2 +1,2 @@' },
        { kind: 'context', text: 'keep' },
        { kind: 'removed', text: 'old' },
        { kind: 'added', text: 'new' },
      ],
    });
    const rows = [...view.querySelectorAll('tr')];
    expect(rows.map((row) => row.textContent)).toEqual(['@@ -1,2 +1,2 @@', ' keep', '-old', '+new']);
    for (const row of rows) expect(row.querySelectorAll('td')).toHaveLength(1);
  });

  it('shows the lines before any hunk line with no header row', () => {
    const view = render({
      binary: false,
      cut: false,
      lines: [
        { kind: 'context', text: 'first' },
        { kind: 'hunk', text: '@@ -5 +5 @@' },
        { kind: 'added', text: 'later' },
      ],
    });
    expect([...view.querySelectorAll('tr')].map((row) => row.textContent)).toEqual([' first', '@@ -5 +5 @@', '+later']);
  });

  it('shows an empty view with no lines and no notes', () => {
    expect(render({ binary: false, cut: false, lines: [] }).textContent).toBe('');
  });
});
