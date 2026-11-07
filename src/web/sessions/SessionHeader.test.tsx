import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SessionHeader } from './SessionHeader';
import { StateBadge } from './StateBadge';

const decode = (html: string) => html.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const text = (html: string) => decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const session = { folder: '/home/dev/progetti/negozio', label: 'Aggiungi il carrello', state: 'needs_input' as const };
const usage = {
  context: { used: 45_200, window: 200_000 },
  tokens: { input: 1_000, output: 2_000, cacheWrite: 3_000, cacheRead: 4_000 },
  cost: { usd: 1.27, incomplete: false },
};
const actions = <button type="button">Azione</button>;
/** The opening tag of the `.mono-chip` that holds `line`. */
const lineChipTag = (html: string, line: string) =>
  [...html.matchAll(/<span\b[^>]*class="[^"]*\bmono-chip\b[^"]*"[^>]*>/g)].find((match) => html.slice(match.index).replace(/<[^>]*>/g, '').startsWith(line))?.[0];

describe('SessionHeader', () => {
  // plan-session_list_width/REQ-15, REQ-16: only the folder name, the line, the state pill, the notice and the actions, in this order
  it('shows the folder name as h2, the line, the state chip, the notice and the actions, in this order', () => {
    const html = renderToStaticMarkup(<SessionHeader session={session} actions={actions} notice={<span>Avviso</span>} />);
    const chip = renderToStaticMarkup(<StateBadge state="needs_input" variant="chip" />);
    expect(html).toContain(chip);
    expect(html).toMatch(/<h2[^>]*>\s*negozio\s*<\/h2>/);
    expect(html.indexOf('<h2')).toBeLessThan(html.indexOf(chip));
    expect(text(html)).toBe('negozio Aggiungi il carrello Needs Input Avviso Azione');
  });

  // plan-session_list_width/REQ-30, REQ-31: the leading actions come first in the right group, then the state pill, the notice and the actions
  it('shows the leading actions before the state pill, then the notice and the actions', () => {
    const html = renderToStaticMarkup(
      <SessionHeader session={session} leadingActions={<button type="button">Cerca</button>} actions={actions} notice={<span>Avviso</span>} />,
    );
    const chip = renderToStaticMarkup(<StateBadge state="needs_input" variant="chip" />);
    expect(text(html)).toBe('negozio Aggiungi il carrello Cerca Needs Input Avviso Azione');
    expect(html.indexOf('Cerca')).toBeLessThan(html.indexOf(chip));
    expect(html.indexOf(chip)).toBeLessThan(html.indexOf('Azione'));
  });

  // SessionHeader "Shows": without a session, the leading actions still show, before the notice and the actions
  it('without a session still shows the leading actions, the notice and the actions', () => {
    const html = renderToStaticMarkup(<SessionHeader leadingActions={<button type="button">Cerca</button>} actions={actions} notice={<span>Avviso</span>} />);
    expect(text(html)).toBe('Cerca Avviso Azione');
  });

  // plan-session_list_width/REQ-15: no "/", no path and no figures, even when the session has usage
  it('shows no "/", no path and no usage figures', () => {
    const html = renderToStaticMarkup(<SessionHeader session={{ ...session, usage }} actions={actions} />);
    expect(text(html)).toBe('negozio Aggiungi il carrello Needs Input Azione');
    expect(html).not.toContain(session.folder);
    expect(text(html)).not.toMatch(/Context|tokens|\$/);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-30: no project avatar
  it('shows no project avatar', () => {
    const html = renderToStaticMarkup(<SessionHeader session={session} actions={actions} />);
    expect(html).not.toMatch(/class="[^"]*\bavatar\b/);
  });

  // SessionHeader "Shows": the tooltip of the h2 is the folder name
  it('gives the folder name its full text as tooltip', () => {
    const long = { ...session, folder: `/home/progetti/${'fine'.repeat(30)}` };
    const html = renderToStaticMarkup(<SessionHeader session={long} actions={actions} />);
    expect(html).toMatch(new RegExp(`<h2[^>]*title="${'fine'.repeat(30)}"`));
  });

  // plan-session_list_width/REQ-18: the line chip is reachable with Tab
  it('makes the line chip focusable with the keyboard', () => {
    const tag = lineChipTag(renderToStaticMarkup(<SessionHeader session={session} actions={actions} />), session.label);
    expect(tag).toBeDefined();
    expect(tag).toMatch(/\stabindex="0"/);
  });

  // SessionHeader "Shows": pointer away and focus elsewhere → no tooltip
  it('shows no tooltip of the line before hover or focus', () => {
    expect(renderToStaticMarkup(<SessionHeader session={session} actions={actions} />)).not.toContain('role="tooltip"');
  });

  // SessionHeader props: `line` replaces the label
  it('shows the given line in place of the label', () => {
    const html = renderToStaticMarkup(<SessionHeader session={session} actions={actions} line="Riga data" />);
    expect(text(html)).toBe('negozio Riga data Needs Input Azione');
    expect(lineChipTag(html, 'Riga data')).toBeDefined();
  });

  // SessionHeader "Shows": no line chip when the text is empty
  it('shows no line chip when the line is empty', () => {
    const html = renderToStaticMarkup(<SessionHeader session={{ ...session, label: '' }} actions={actions} />);
    expect(html).not.toMatch(/class="[^"]*\bmono-chip\b/);
    expect(text(html)).toBe('negozio Needs Input Azione');
  });

  // SessionHeader "Shows": without a session, only the notice and the actions
  it('without a session shows no h2 or state pill, but still the notice and the actions', () => {
    const html = renderToStaticMarkup(<SessionHeader actions={actions} notice={<span>Avviso</span>} />);
    expect(html).not.toContain('<h2');
    expect(html).not.toContain('Needs Input');
    expect(text(html)).toBe('Avviso Azione');
  });
});
