import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ShortMessageToast } from './ShortMessageToast';

describe('ShortMessageToast', () => {
  it('renders nothing without a text', () => {
    expect(renderToStaticMarkup(<ShortMessageToast text={null} />)).toBe('');
  });

  // plan-dark_blue_theme/REQ-15: a decorative accent dot, then the text
  it('shows a decorative dot before the text in a status box', () => {
    const html = renderToStaticMarkup(<ShortMessageToast text="No session needs input" />);
    const box = /^<div([^>]*)>(.*)<\/div>$/.exec(html);
    expect(box).not.toBeNull();
    expect(box![1]).toContain('role="status"');
    const inner = box![2]!;
    expect(inner).toMatch(/^<span[^>]*aria-hidden="true"[^>]*><\/span>No session needs input$/);
  });
});
