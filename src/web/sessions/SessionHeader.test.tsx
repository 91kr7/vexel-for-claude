import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Avatar } from './Avatar';
import { SessionHeader } from './SessionHeader';
import { StateBadge } from './StateBadge';

const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const classesOf = (tag: string) => tag.match(/\sclass="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];
const session = { folder: '/home/dev/progetti/negozio', label: 'Aggiungi il carrello', state: 'needs_input' as const };
const actions = <button type="button">Azione</button>;

describe('SessionHeader', () => {
  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-29: avatar, folder name, state chip, line, actions
  it('shows the header avatar, the folder name as h2, the state chip, the notice, the line and the actions, in this order', () => {
    const html = renderToStaticMarkup(<SessionHeader session={session} actions={actions} notice={<span>Avviso</span>} />);
    const avatar = renderToStaticMarkup(<Avatar folder={session.folder} state={session.state} size="header" />);
    const chip = renderToStaticMarkup(<StateBadge state="needs_input" variant="chip" />);
    expect(html).toContain(avatar);
    expect(html).toContain(chip);
    expect(html).not.toContain('state-badge');
    expect(html).toMatch(/<h2[^>]*>\s*negozio\s*<\/h2>/);
    expect(html.indexOf(avatar)).toBeLessThan(html.indexOf('<h2'));
    expect(html.indexOf('<h2')).toBeLessThan(html.indexOf(chip));
    expect(text(html)).toMatch(/^NE negozio Richiede input Avviso Aggiungi il carrello · \/home\/dev\/progetti\/negozio Azione$/);
  });

  // SessionHeader "Shows": the h2 in .title-l, the line in .body-m
  it('gives the h2 the class title-l and the line the class body-m', () => {
    const html = renderToStaticMarkup(<SessionHeader session={session} actions={actions} />);
    const h2 = html.match(/<h2\b[^>]*>/)?.[0] ?? '';
    expect(classesOf(h2)).toContain('title-l');
    const line = html.match(/<[a-z]+\b[^>]*>(?=Aggiungi il carrello · )/)?.[0] ?? '';
    expect(classesOf(line)).toContain('body-m');
  });

  // SessionHeader "Rules": cut text keeps its full text as tooltip
  it('gives the h2 and the line their full text as tooltip', () => {
    const long = { ...session, label: 'L'.repeat(300), folder: `/home/${'cartella/'.repeat(40)}${'fine'.repeat(30)}` };
    const html = renderToStaticMarkup(<SessionHeader session={long} actions={actions} />);
    expect(html).toMatch(new RegExp(`<h2[^>]*title="${'fine'.repeat(30)}"`));
    expect(html).toContain(`title="${long.label} · ${long.folder}"`);
  });

  // SessionHeader props: `line` replaces the default line
  it('shows the given line in place of "<label> · <folder>"', () => {
    const html = renderToStaticMarkup(<SessionHeader session={session} actions={actions} line="Riga data" />);
    expect(text(html)).toContain('Riga data');
    expect(html).toContain('title="Riga data"');
    expect(html).not.toContain('Aggiungi il carrello');
  });

  // SessionHeader props: `external` gives the Avatar its outlined terminal form
  it('passes `external` to the header Avatar', () => {
    const html = renderToStaticMarkup(<SessionHeader session={session} actions={actions} external />);
    expect(html).toContain(renderToStaticMarkup(<Avatar folder={session.folder} state={session.state} external size="header" />));
    expect(html).not.toContain(renderToStaticMarkup(<Avatar folder={session.folder} state={session.state} size="header" />));
  });

  // SessionHeader "Shows": without a session, only the notice and the actions
  it('without a session shows no avatar, h2, chip or line, but still the notice and the actions', () => {
    const html = renderToStaticMarkup(<SessionHeader actions={actions} notice={<span>Avviso</span>} />);
    expect(html).not.toContain('<h2');
    expect(html).not.toContain('state-chip');
    expect(html).not.toContain('avatar');
    expect(text(html)).toBe('Avviso Azione');
  });
});
