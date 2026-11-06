import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LoaderCircleIcon } from '../icons/Icons';
import { ProgressIndicator, Spinner } from './ProgressIndicator';

const rootTag = (html: string) => html.match(/^<[a-z]+\b[^>]*>/)?.[0] ?? '';
const classes = (tag: string) => tag.match(/\sclass="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];
const textOf = (html: string) => html.replace(/<[^>]*>/g, '');
const visibleText = (html: string) => textOf(html.replace(/<([a-z]+)\b[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/\1>/g, ''));
const icon = renderToStaticMarkup(<LoaderCircleIcon />);

describe('ProgressIndicator', () => {
  // plan-claude_sessions_client-ui_redesign/REQ-29, ProgressIndicator: a status whose text is the default label
  it('is a status whose text is exactly "Loading…" by default', () => {
    const html = renderToStaticMarkup(<ProgressIndicator />);
    expect(rootTag(html)).toMatch(/\srole="status"/);
    expect(textOf(html)).toBe('Loading…');
  });

  // ProgressIndicator: the text is exactly the given label
  it('reads the given label', () => {
    expect(textOf(renderToStaticMarkup(<ProgressIndicator label="Lettura in corso" />))).toBe('Lettura in corso');
  });

  // plan-claude_sessions_client-ui_redesign/REQ-1, ProgressIndicator: the loader icon comes before the label
  it('shows the loader icon before the label', () => {
    const html = renderToStaticMarkup(<ProgressIndicator />);
    expect(html).toContain(icon);
    expect(html.indexOf(icon)).toBeLessThan(html.indexOf('Loading…'));
  });

  // ProgressIndicator: className is an extra class
  it('adds className to its own classes', () => {
    const own = classes(rootTag(renderToStaticMarkup(<ProgressIndicator />)));
    const extended = classes(rootTag(renderToStaticMarkup(<ProgressIndicator className="extra" />)));
    expect(extended).toEqual(expect.arrayContaining([...own, 'extra']));
  });
});

describe('Spinner', () => {
  // plan-claude_sessions_client-ui_redesign/REQ-31, ProgressIndicator: the spinner is the loader icon alone, decorative
  it('is the loader icon alone, hidden from screen readers, with no text and no role', () => {
    const html = renderToStaticMarkup(<Spinner />);
    expect(html).toContain(icon);
    expect(html).toContain('aria-hidden="true"');
    expect(visibleText(html)).toBe('');
    expect(html).not.toMatch(/\srole="/);
  });
});
