import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SessionHeader } from './SessionHeader';

const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const session = { folder: '/home/dev/progetti/negozio', label: 'Aggiungi il carrello', state: 'needs_input' as const };
const actions = <button type="button">Azione</button>;

describe('SessionHeader', () => {
  // plan-claude_sessions_client-ui_redesign/REQ-17
  it('shows the label as an h2, then the state, then the notice, then the folder, and the actions', () => {
    const html = renderToStaticMarkup(<SessionHeader session={session} actions={actions} notice={<span>Avviso</span>} />);
    expect(html).toMatch(/<h2[^>]*>\s*Aggiungi il carrello\s*<\/h2>/);
    expect(html).toContain('state-needs_input');
    expect(text(html)).toMatch(/Aggiungi il carrello.*Richiede input.*Avviso.*\/home\/dev\/progetti\/negozio.*Azione/);
  });

  it('gives the full label and folder as tooltip, so cut text stays readable', () => {
    const long = { ...session, label: 'L'.repeat(300), folder: `/home/${'cartella/'.repeat(40)}fine` };
    const html = renderToStaticMarkup(<SessionHeader session={long} actions={actions} />);
    expect(html).toMatch(new RegExp(`<h2[^>]*title="${long.label}"`));
    expect(html).toContain(`title="${long.folder}"`);
  });

  it('without a session shows no label, state or folder, but still the notice and the actions', () => {
    const html = renderToStaticMarkup(<SessionHeader actions={actions} notice={<span>Avviso</span>} />);
    expect(html).not.toContain('<h2');
    expect(html).not.toContain('state-badge');
    expect(text(html)).toBe('Avviso Azione');
  });
});
