import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NavigationRail } from './NavigationRail';

const textOf = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const noop = () => {};

const renderRail = (needsInputCount: number) =>
  renderToStaticMarkup(<NavigationRail needsInputCount={needsInputCount} onNewSession={noop} onShowSessions={noop} onResume={noop} />);

interface Button {
  attributes: string;
  html: string;
}

const buttons = (html: string): Button[] =>
  [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attributes: m[1] ?? '', html: m[2] ?? '' }));

/** Accessible name of a button: aria-label, else its text without aria-hidden subtrees. */
function nameOf(button: Button): string {
  const label = button.attributes.match(/aria-label="([^"]*)"/)?.[1];
  if (label !== undefined) return label;
  let html = button.html;
  for (let previous = ''; previous !== html; ) {
    previous = html;
    html = html.replace(/<(\w+)\b[^>]*aria-hidden="true"[^>]*>(?:(?!<\1\b)[\s\S])*?<\/\1>/, '');
  }
  return textOf(html);
}

const byName = (html: string, name: string) => buttons(html).filter((b) => nameOf(b) === name);
const badgeOf = (button: Button) => button.html.match(/<(\w+)([^>]*class="[^"]*\bnav-rail-badge\b[^"]*"[^>]*)>([\s\S]*?)<\/\1>/);

describe('NavigationRail', () => {
  // NavigationRail "Description": a nav labelled "Navigazione principale"
  it('is a nav labelled "Navigazione principale"', () => {
    expect(renderRail(0)).toMatch(/^<nav\b[^>]*aria-label="Navigazione principale"/);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-6: logo, "Nuova sessione", "Sessioni" and "Riprendi", in this order
  it('shows the logo, then the buttons "Nuova sessione", "Sessioni" and "Riprendi"', () => {
    const html = renderRail(0);
    const logo = html.search(/<svg\b[^>]*role="img"[^>]*aria-label="Vexel"|<svg\b[^>]*aria-label="Vexel"[^>]*role="img"/);
    expect(logo, 'the logo is an svg with role="img" and label "Vexel"').toBeGreaterThan(-1);
    expect(buttons(html).map(nameOf)).toEqual(['Nuova sessione', 'Sessioni', 'Riprendi']);
    expect(logo).toBeLessThan(html.indexOf('<button'));
  });

  // NavigationRail "Shows": seven 5 px squares with 1.5 px radius, one of them at the bottom
  it('draws the logo as seven 5 px squares with one alone at the bottom', () => {
    const svg = renderRail(0).match(/<svg\b[^>]*aria-label="Vexel"[^>]*>([\s\S]*?)<\/svg>/)?.[1] ?? '';
    const rects = [...svg.matchAll(/<rect\b([^>]*)>/g)].map((m) => m[1] ?? '');
    expect(rects).toHaveLength(7);
    for (const rect of rects) {
      expect(rect).toMatch(/\swidth="5"/);
      expect(rect).toMatch(/\sheight="5"/);
      expect(rect).toMatch(/\srx="1.5"/);
    }
    const bottom = rects.at(-1)?.match(/\sy="([\d.]+)"/)?.[1];
    for (const rect of rects.slice(0, -1)) expect(Number(rect.match(/\sy="([\d.]+)"/)?.[1])).toBeLessThan(Number(bottom));
  });

  // NavigationRail rules: the icons are decorative
  it('hides every icon of the buttons from assistive technology', () => {
    for (const button of buttons(renderRail(3))) {
      const svgs = [...button.html.matchAll(/<svg\b[^>]*>/g)].map((m) => m[0]);
      expect(svgs.length, nameOf(button)).toBeGreaterThan(0);
      for (const svg of svgs) expect(svg, nameOf(button)).toContain('aria-hidden="true"');
    }
  });

  // NavigationRail "Shows": "Sessioni" always has aria-current="page", "Riprendi" has none
  it.each([0, 4])('marks "Sessioni" as the current page and "Riprendi" not, with %i sessions needing input', (count) => {
    const html = renderRail(count);
    expect(byName(html, 'Sessioni')[0]?.attributes).toMatch(/aria-current="page"/);
    expect(byName(html, 'Riprendi')[0]?.attributes).not.toMatch(/aria-current/);
    expect(byName(html, 'Nuova sessione')[0]?.attributes).not.toMatch(/aria-current/);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-9: the badge shows the number on "Sessioni"
  it.each([1, 3, 12])('shows the badge %i on "Sessioni", hidden from assistive technology', (count) => {
    const sessions = byName(renderRail(count), 'Sessioni');
    expect(sessions, 'the accessible name stays "Sessioni"').toHaveLength(1);
    const badge = badgeOf(sessions[0]!);
    expect(badge).not.toBeNull();
    expect(textOf(badge?.[3] ?? '')).toBe(String(count));
    expect(badge?.[2]).toContain('aria-hidden="true"');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-9: hidden at zero
  it('shows no badge and no number when no session needs input', () => {
    const html = renderRail(0);
    expect(html).not.toMatch(/\bnav-rail-badge\b/);
    expect(textOf(html)).not.toMatch(/\d/);
  });

  // NavigationRail "Shows": the destinations carry their visible text
  it('shows the visible texts "Sessioni" and "Riprendi" under their indicators', () => {
    const html = renderRail(0);
    expect(textOf(byName(html, 'Sessioni')[0]?.html ?? '')).toBe('Sessioni');
    expect(textOf(byName(html, 'Riprendi')[0]?.html ?? '')).toBe('Riprendi');
    expect(textOf(byName(html, 'Nuova sessione')[0]?.html ?? '')).toBe('');
  });
});
