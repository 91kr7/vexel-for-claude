import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CircleXIcon } from '../icons/Icons';
import { ErrorMessage } from './ErrorMessage';

const rootTag = (html: string) => html.match(/^<[a-z]+\b[^>]*>/)?.[0] ?? '';
const classes = (tag: string) => tag.match(/\sclass="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];
const textOf = (html: string) => html.replace(/<[^>]*>/g, '');
const icon = renderToStaticMarkup(<CircleXIcon />);

describe('ErrorMessage', () => {
  // plan-claude_sessions_client-ui_redesign/REQ-30, ErrorMessage: an alert whose text is exactly the message
  it('is an alert whose text is exactly its message', () => {
    const html = renderToStaticMarkup(<ErrorMessage>The folder does not exist.</ErrorMessage>);
    expect(rootTag(html)).toMatch(/\srole="alert"/);
    expect(textOf(html)).toBe('The folder does not exist.');
  });

  // plan-claude_sessions_client-ui_redesign/REQ-1, ErrorMessage: a decorative circle-x icon before the text
  it('shows the decorative circle-x icon before the text', () => {
    const html = renderToStaticMarkup(<ErrorMessage>Errore.</ErrorMessage>);
    expect(html).toContain(icon);
    expect(icon).toContain('aria-hidden="true"');
    expect(html.indexOf(icon)).toBeLessThan(html.indexOf('Errore.'));
  });

  // ErrorMessage: className is an extra class
  it('adds className to its own classes', () => {
    const own = classes(rootTag(renderToStaticMarkup(<ErrorMessage>Errore.</ErrorMessage>)));
    const extended = classes(rootTag(renderToStaticMarkup(<ErrorMessage className="extra">Errore.</ErrorMessage>)));
    expect(extended).toEqual(expect.arrayContaining([...own, 'extra']));
  });
});
