import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FavoriteIndicator } from './FavoriteIndicator';

describe('FavoriteIndicator', () => {
  // plan-favorite_session/REQ-11, REQ-12: a star with the accessible name and the tooltip "Favorite"
  it('is an image named "Favorite", with the tooltip "Favorite", holding one filled star svg', () => {
    const html = renderToStaticMarkup(<FavoriteIndicator />);
    const tag = html.match(/^<span\b[^>]*>/)?.[0] ?? '';
    expect(tag).toMatch(/\srole="img"/);
    expect(tag).toMatch(/\saria-label="Favorite"/);
    expect(tag).toMatch(/\stitle="Favorite"/);
    expect(html.match(/<svg\b/g)).toHaveLength(1);
    expect(html).toMatch(/<svg\b[^>]*\sfill="currentColor"/);
  });

  // FavoriteIndicator rule: it is not focusable and takes no action
  it('is not focusable and has no button or link inside', () => {
    const html = renderToStaticMarkup(<FavoriteIndicator />);
    expect(html).not.toMatch(/\stabindex=/i);
    expect(html).not.toMatch(/<(?:button|a|input)\b/);
  });
});
