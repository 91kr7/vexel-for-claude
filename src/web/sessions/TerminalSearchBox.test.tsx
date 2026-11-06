import { type ReactElement, type ReactNode, isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TerminalSearchBox, type TerminalSearchResults } from './TerminalSearchBox';

type Props = Parameters<typeof TerminalSearchBox>[0];
type AnyElement = ReactElement<Record<string, unknown> & { children?: ReactNode }>;

const propsWith = (overrides: Partial<Props> = {}): Props => ({
  query: 'error',
  results: { index: 0, total: 3 },
  onQueryChange: vi.fn(),
  onNext: vi.fn(),
  onPrevious: vi.fn(),
  onClose: vi.fn(),
  ...overrides,
});

const render = (overrides: Partial<Props> = {}) => renderToStaticMarkup(<TerminalSearchBox {...propsWith(overrides)} />);
const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const countOf = (html: string) => text(html.match(/<[a-z]+\b[^>]*\srole="status"[^>]*>([\s\S]*?)<\/[a-z]+>/)?.[1] ?? '<no status>');
const tagWith = (html: string, label: string) => html.match(new RegExp(`<[a-z]+\\b[^>]*\\saria-label="${label}"[^>]*>`))?.[0] ?? '';

/** The element tree the box returns, without React rendering it: the box has no state of its own. */
function elementsOf(props: Props): AnyElement[] {
  const all: AnyElement[] = [];
  const walk = (node: ReactNode) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!isValidElement(node)) return;
    const element = node as AnyElement;
    all.push(element);
    walk(element.props.children);
  };
  walk(TerminalSearchBox(props) as ReactNode);
  return all;
}

const byLabel = (props: Props, label: string) => {
  const found = elementsOf(props).find((element) => element.props['aria-label'] === label);
  if (!found) throw new Error(`no element named ${label}`);
  return found.props as Record<string, (event: unknown) => void>;
};

const keyEvent = (key: string, shiftKey = false) => ({ key, shiftKey, ctrlKey: false, altKey: false, metaKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn() });

/** Fires the key on the field, then on the box as React would bubble it, unless the field stopped it. */
function pressInField(props: Props, event: ReturnType<typeof keyEvent>): void {
  byLabel(props, 'Search in terminal').onKeyDown?.(event);
  if (event.stopPropagation.mock.calls.length === 0) byLabel(props, 'Terminal search').onKeyDown?.(event);
}

describe('TerminalSearchBox', () => {
  // plan-terminal_addons/REQ-26: the count text
  it.each<[string, string, TerminalSearchResults | null, string]>([
    ['the current position and the total', 'error', { index: 2, total: 12 }, '3 of 12'],
    ['the first match as 1', 'error', { index: 0, total: 3 }, '1 of 3'],
    ['"No results" with no match', 'zzz', { index: -1, total: 0 }, 'No results'],
    ['"<total>+ results" past the highlight limit', 'e', { index: -1, total: 1000 }, '1000+ results'],
    ['nothing before the first search', 'error', null, ''],
    ['nothing with an empty field', '', { index: 0, total: 3 }, ''],
  ])('shows %s', (_, query, results, expected) => {
    expect(countOf(render({ query, results }))).toBe(expected);
  });

  // plan-terminal_addons/REQ-30: the box is a landmark, the field and the controls have their accessible names and tooltips
  it('is a search landmark named "Terminal search" with a named field, count and controls', () => {
    const html = render();
    expect(tagWith(html, 'Terminal search')).toMatch(/\srole="search"/);
    const field = tagWith(html, 'Search in terminal');
    expect(field).toMatch(/^<input\b/);
    expect(field).toContain('placeholder="Search"');
    expect(field).toContain('value="error"');
    expect(tagWith(html, 'Previous match')).toMatch(/^<button\b(?=[^>]*\stitle="Previous match \(Shift\+Enter\)")/);
    expect(tagWith(html, 'Next match')).toMatch(/^<button\b(?=[^>]*\stitle="Next match \(Enter\)")/);
    expect(tagWith(html, 'Close search')).toMatch(/^<button\b(?=[^>]*\stitle="Close \(Esc\)")/);
  });

  // plan-terminal_addons/REQ-30: Tab order field, "Previous match", "Next match", "Close search", with no tabindex that changes it
  it('puts the field, the count and the three controls in this order, with the natural tab order', () => {
    const html = render();
    const positions = ['aria-label="Search in terminal"', 'role="status"', 'aria-label="Previous match"', 'aria-label="Next match"', 'aria-label="Close search"'].map((mark) => html.indexOf(mark));
    for (const position of positions) expect(position).toBeGreaterThan(-1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html).not.toMatch(/\stabindex=/i);
  });

  // plan-terminal_addons/REQ-30
  it('draws decorative icons inside the controls, so their names come from the labels', () => {
    const html = render();
    for (const label of ['Previous match', 'Next match', 'Close search']) {
      const inner = html.match(new RegExp(`aria-label="${label}"[^>]*>([\\s\\S]*?)</button>`))?.[1] ?? '';
      expect(inner).toMatch(/^<svg\b[^>]*aria-hidden="true"/);
      expect(text(inner)).toBe('');
    }
  });

  // plan-terminal_addons/REQ-21: each change of the field reports the new text
  it('reports each change of the field with its new text', () => {
    const props = propsWith();
    byLabel(props, 'Search in terminal').onChange?.({ target: { value: 'erro' } });
    expect(props.onQueryChange).toHaveBeenCalledWith('erro');
  });

  // plan-terminal_addons/REQ-24: Enter in the field goes to the next match, without the browser default
  it('Enter in the field calls onNext only and prevents the default', () => {
    const props = propsWith();
    const event = keyEvent('Enter');
    pressInField(props, event);
    expect(props.onNext).toHaveBeenCalledTimes(1);
    expect(props.onPrevious).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
  });

  // plan-terminal_addons/REQ-25: Shift+Enter in the field goes to the previous match, without the browser default
  it('Shift+Enter in the field calls onPrevious only and prevents the default', () => {
    const props = propsWith();
    const event = keyEvent('Enter', true);
    pressInField(props, event);
    expect(props.onPrevious).toHaveBeenCalledTimes(1);
    expect(props.onNext).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
  });

  // plan-terminal_addons/REQ-27: Esc closes the box, prevents the default and does not reach the ancestors
  it('Esc in the field calls onClose, prevents the default and stops the key', () => {
    const props = propsWith();
    const event = keyEvent('Escape');
    pressInField(props, event);
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  // plan-terminal_addons/REQ-27: Esc anywhere in the box, e.g. on a control, closes it
  it('Esc on a control of the box calls onClose and stops the key', () => {
    const props = propsWith();
    const event = keyEvent('Escape');
    byLabel(props, 'Terminal search').onKeyDown?.(event);
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it('other keys in the field call nothing and keep their default', () => {
    const props = propsWith();
    const event = keyEvent('a');
    pressInField(props, event);
    expect(props.onNext).not.toHaveBeenCalled();
    expect(props.onPrevious).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  // plan-terminal_addons/REQ-24, REQ-25, REQ-27: the controls
  it.each<[string, keyof Props]>([
    ['Previous match', 'onPrevious'],
    ['Next match', 'onNext'],
    ['Close search', 'onClose'],
  ])('"%s" calls %s', (label, callback) => {
    const props = propsWith();
    byLabel(props, label).onClick?.({});
    expect(props[callback]).toHaveBeenCalledTimes(1);
    for (const other of ['onPrevious', 'onNext', 'onClose'] as const) if (other !== callback) expect(props[other]).not.toHaveBeenCalled();
  });
});
