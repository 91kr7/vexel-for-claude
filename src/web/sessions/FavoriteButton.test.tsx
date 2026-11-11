import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FavoriteButton } from './FavoriteButton';

const button = (html: string) => html.match(/<button\b[^>]*>/)?.[0] ?? '';

describe('FavoriteButton', () => {
  // plan-favorite_session/REQ-1, REQ-12: the name and the tooltip of an unmarked session
  it('is named "Mark as Favorite", with the same tooltip, and draws an outline star when not marked', () => {
    const html = renderToStaticMarkup(<FavoriteButton sessionId="a" favorite={false} />);
    expect(button(html)).toMatch(/\saria-label="Mark as Favorite"/);
    expect(button(html)).toMatch(/\stitle="Mark as Favorite"/);
    expect(html).toMatch(/<svg\b[^>]*\sfill="none"/);
  });

  // plan-favorite_session/REQ-5, REQ-12: the name and the tooltip of a marked session
  it('is named "Remove Favorite", with the same tooltip, and draws a filled star when marked', () => {
    const html = renderToStaticMarkup(<FavoriteButton sessionId="a" favorite />);
    expect(button(html)).toMatch(/\saria-label="Remove Favorite"/);
    expect(button(html)).toMatch(/\stitle="Remove Favorite"/);
    expect(html).toMatch(/<svg\b[^>]*\sfill="currentColor"/);
  });

  // plan-favorite_session/REQ-13: a native button, so Enter and Space press it and Tab reaches it
  it('is a native button of type "button", not removed from the tab order', () => {
    const tag = button(renderToStaticMarkup(<FavoriteButton sessionId="a" favorite={false} />));
    expect(tag).toMatch(/\stype="button"/);
    expect(tag).not.toMatch(/\stabindex="-1"/i);
  });

  it('is not busy and shows no error at the start', () => {
    const html = renderToStaticMarkup(<FavoriteButton sessionId="a" favorite={false} />);
    expect(button(html)).not.toMatch(/aria-busy|aria-disabled/);
    expect(html).not.toContain('Could not change the favorite mark.');
  });

  // FavoriteButton prop: hidden hides the button
  it('is hidden with the prop hidden', () => {
    const tag = button(renderToStaticMarkup(<FavoriteButton sessionId="a" favorite={false} hidden />));
    expect(tag).toMatch(/\shidden(?:=""|\s|>)/);
  });
});
