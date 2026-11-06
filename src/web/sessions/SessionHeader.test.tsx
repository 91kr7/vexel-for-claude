import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SessionHeader } from './SessionHeader';
import { StateBadge } from './StateBadge';

const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const session = { folder: '/home/dev/progetti/negozio', label: 'Aggiungi il carrello', state: 'needs_input' as const };
const actions = <button type="button">Azione</button>;

describe('SessionHeader', () => {
  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-30, REQ-31: name, "/", path, line, state pill, notice, actions
  it('shows the folder name as h2, "/", the path, the line, the state chip, the notice and the actions, in this order', () => {
    const html = renderToStaticMarkup(<SessionHeader session={session} actions={actions} notice={<span>Avviso</span>} />);
    const chip = renderToStaticMarkup(<StateBadge state="needs_input" variant="chip" />);
    expect(html).toContain(chip);
    expect(html).toMatch(/<h2[^>]*>\s*negozio\s*<\/h2>/);
    expect(html.indexOf('<h2')).toBeLessThan(html.indexOf(chip));
    expect(text(html)).toBe('negozio / /home/dev/progetti/negozio Aggiungi il carrello Needs Input Avviso Azione');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-30: no project avatar
  it('shows no project avatar', () => {
    const html = renderToStaticMarkup(<SessionHeader session={session} actions={actions} />);
    expect(html).not.toMatch(/class="[^"]*\bavatar\b/);
  });

  // SessionHeader spec: "/" is hidden from assistive technology
  it('hides the "/" separator from assistive technology', () => {
    const html = renderToStaticMarkup(<SessionHeader session={session} actions={actions} />);
    expect(html).toMatch(/<\w+\b[^>]*aria-hidden="true"[^>]*>\s*\/\s*</);
  });

  // SessionHeader "Rules": cut text keeps its full text as tooltip
  it('gives the name, the path and the line their full text as tooltip', () => {
    const long = { ...session, label: 'L'.repeat(300), folder: `/home/${'cartella/'.repeat(40)}${'fine'.repeat(30)}` };
    const html = renderToStaticMarkup(<SessionHeader session={long} actions={actions} />);
    expect(html).toMatch(new RegExp(`<h2[^>]*title="${'fine'.repeat(30)}"`));
    expect(html).toContain(`title="${long.folder}"`);
    expect(html).toContain(`title="${long.label}"`);
  });

  // SessionHeader props: `line` replaces the label
  it('shows the given line in place of the label', () => {
    const html = renderToStaticMarkup(<SessionHeader session={session} actions={actions} line="Riga data" />);
    expect(text(html)).toContain('Riga data');
    expect(html).toContain('title="Riga data"');
    expect(html).not.toContain('Aggiungi il carrello');
  });

  // SessionHeader "Shows": no line chip when the text is empty
  it('shows no line chip when the line is empty', () => {
    const html = renderToStaticMarkup(<SessionHeader session={{ ...session, label: '' }} actions={actions} />);
    expect(html).not.toMatch(/class="[^"]*\bmono-chip\b/);
    expect(text(html)).toBe('negozio / /home/dev/progetti/negozio Needs Input Azione');
  });

  // SessionHeader "Shows": without a session, only the notice and the actions
  it('without a session shows no h2, path or state pill, but still the notice and the actions', () => {
    const html = renderToStaticMarkup(<SessionHeader actions={actions} notice={<span>Avviso</span>} />);
    expect(html).not.toContain('<h2');
    expect(html).not.toContain('Needs Input');
    expect(text(html)).toBe('Avviso Azione');
  });
});
