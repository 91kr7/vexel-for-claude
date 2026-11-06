import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SessionUsage } from './live-session-store';
import { SessionFooter } from './SessionFooter';

/** The visible text: the tokens tooltip shows only on hover or focus. */
const text = (html: string) =>
  html.replace(/<span[^>]*role="tooltip"[^>]*>(<span[^>]*>(<span[^>]*>[^<]*<\/span>)*<\/span>)*<\/span>/g, '').replace(/<[^>]*>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
const folder = '/home/dev/progetti/negozio';
const usage: SessionUsage = {
  context: { used: 45_200, window: 200_000 },
  tokens: { input: 12_000, output: 38_000, cacheWrite: 250_000, cacheRead: 1_000_000 },
  cost: { usd: 1.27, incomplete: false },
};
const end = <button type="button">Fine</button>;

describe('SessionFooter', () => {
  // plan-session_list_width/REQ-19, REQ-20: a footer with the path, then the figures
  it('shows a footer with the path, then the context, the tokens and the cost', () => {
    const html = renderToStaticMarkup(<SessionFooter session={{ folder, usage }} />);
    expect(html).toMatch(/^<footer\b/);
    expect(text(html)).toBe(`${folder} Context 45.2k / 200k · 23% 1.3M tokens $1.27`);
  });

  // plan-session_list_width/REQ-21: the lead text before the path
  it('shows the lead text before the path', () => {
    const html = renderToStaticMarkup(<SessionFooter session={{ folder, usage }} lead="Open in Another Terminal · " />);
    expect(text(html)).toBe(`Open in Another Terminal · ${folder} Context 45.2k / 200k · 23% 1.3M tokens $1.27`);
  });

  // plan-session_list_width/REQ-25: the full path is the tooltip of the place
  it('gives the place the full path as tooltip', () => {
    const long = `/home/${'cartella/'.repeat(40)}fine`;
    const html = renderToStaticMarkup(<SessionFooter session={{ folder: long }} lead="Open in Another Terminal · " />);
    expect(html).toContain(`title="${long}"`);
  });

  // plan-session_list_width/REQ-29, SessionFooter "Shows": `end` at the right end, after the figures
  it('shows the end items after the path and the figures', () => {
    const html = renderToStaticMarkup(<SessionFooter session={{ folder, usage }} end={end} />);
    expect(text(html)).toBe(`${folder} Context 45.2k / 200k · 23% 1.3M tokens $1.27 Fine`);
  });

  // plan-session_list_width/REQ-26: no usage → the path and no figures
  it.each<[string, SessionUsage | undefined]>([
    ['no usage', undefined],
    ['empty usage', {}],
  ])('shows only the path with %s', (_name, figures) => {
    const html = renderToStaticMarkup(<SessionFooter session={{ folder, ...(figures ? { usage: figures } : {}) }} end={end} />);
    expect(text(html)).toBe(`${folder} Fine`);
    expect(html).not.toMatch(/class="[^"]*\bmono-chip\b/);
  });

  // SessionFooter "Shows": without `session`, no place, lead or figures; `end` still shows
  it('without a session shows only the end items', () => {
    const html = renderToStaticMarkup(<SessionFooter lead="Open in Another Terminal · " end={end} />);
    expect(html).toMatch(/^<footer\b/);
    expect(text(html)).toBe('Fine');
    expect(html).not.toContain('title=');
  });
});
