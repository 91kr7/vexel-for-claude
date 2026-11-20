import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SessionFigures } from './SessionFigures';

describe('SessionFigures', () => {
  // plan-popup_glass/REQ-1, REQ-2, SessionFigures "Shows": the tokens tooltip is on the popup glass
  it('draws the tokens tooltip with the .vx-popup-glass class', () => {
    const html = renderToStaticMarkup(<SessionFigures usage={{ tokens: { input: 4_000, output: 2_000, cacheWrite: 30_000, cacheRead: 150_000 } }} />);
    expect(html).toMatch(/<span\b[^>]*class="[^"]*\bvx-popup-glass\b[^"]*"[^>]*role="tooltip"/);
  });
});
