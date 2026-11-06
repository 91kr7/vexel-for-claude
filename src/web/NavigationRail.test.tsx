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

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-14, REQ-17: no logo, then "Nuova sessione", "Sessioni" and "Riprendi"
  it('shows no logo and the buttons "Nuova sessione", "Sessioni" and "Riprendi", in this order', () => {
    const html = renderRail(0);
    expect(html).not.toMatch(/role="img"/);
    expect(html).not.toContain('Vexel');
    expect(buttons(html).map(nameOf)).toEqual(['Nuova sessione', 'Sessioni', 'Riprendi']);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-17: a divider between "Nuova sessione" and "Sessioni"
  it('places an element between "Nuova sessione" and "Sessioni"', () => {
    const html = renderRail(0);
    const between = html.slice(html.indexOf('</button>') + '</button>'.length, html.indexOf('<button', html.indexOf('</button>')));
    expect(between).toMatch(/^<\w+\b[^>]*>/);
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

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-18: no visible label; the tooltip holds the name, hidden from assistive technology
  it.each(['Nuova sessione', 'Sessioni', 'Riprendi'])('"%s" has no visible label and its name in a hidden tooltip', (name) => {
    const button = byName(renderRail(0), name)[0];
    expect(button, name).toBeDefined();
    let visible = button?.html ?? '';
    for (let previous = ''; previous !== visible; ) {
      previous = visible;
      visible = visible.replace(/<(\w+)\b[^>]*aria-hidden="true"[^>]*>(?:(?!<\1\b)[\s\S])*?<\/\1>/, '');
    }
    expect(textOf(visible)).toBe('');
    expect(textOf(button?.html ?? '')).toBe(name);
    expect(button?.html).toMatch(new RegExp(`<\\w+\\b[^>]*aria-hidden="true"[^>]*>${name}</`));
  });
});
