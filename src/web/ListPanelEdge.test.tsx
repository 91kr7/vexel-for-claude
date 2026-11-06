import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ListPanelEdge } from './ListPanelEdge';

const noop = () => {};
const renderEdge = (width: number, maxWidth: number) =>
  renderToStaticMarkup(<ListPanelEdge width={width} maxWidth={maxWidth} onPreview={noop} onCommit={noop} />);
const separatorTag = (html: string) => html.match(/<[a-z]+\b[^>]*role="separator"[^>]*>/)?.[0] ?? '';

// Drag and arrow keys need a browser: e2e/list-width.spec.ts covers them.
describe('ListPanelEdge', () => {
  // plan-session_list_width/REQ-12
  it('is one vertical separator named "Resize Session List" in the Tab order', () => {
    const html = renderEdge(224, 480);
    expect(html.match(/role="separator"/g)).toHaveLength(1);
    const tag = separatorTag(html);
    expect(tag).toContain('aria-label="Resize Session List"');
    expect(tag).toContain('aria-orientation="vertical"');
    expect(tag).toContain('tabindex="0"');
  });

  // ListPanelEdge "Shows": value = width, minimum 180, maximum = maxWidth
  it('gives the shown width as value, 180 as minimum and the window maximum as maximum', () => {
    const tag = separatorTag(renderEdge(300, 348));
    expect(tag).toContain('aria-valuenow="300"');
    expect(tag).toContain('aria-valuemin="180"');
    expect(tag).toContain('aria-valuemax="348"');
  });
});
