import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CircleStopIcon } from '../icons/Icons';
import type { SessionState } from './live-session-store';
import { SessionView } from './SessionView';

const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
const classesOf = (tag: string) => tag.match(/\sclass="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];
const sessionIn = (state: SessionState) => ({ folder: '/home/dev/progetti/billing-api', label: 'Etichetta', state });
const render = (state?: SessionState, snackbar?: ReactElement) =>
  renderToStaticMarkup(
    <SessionView sessionId="s1" session={state ? sessionIn(state) : undefined} onLeaveTerminal={() => {}} snackbar={snackbar} />,
  );
const button = (html: string, name: string) => html.match(new RegExp(`<button\\b([^>]*)>((?:(?!</button>)[\\s\\S])*${name}\\s*)</button>`));

describe('SessionView', () => {
  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-29, REQ-31: "Interrompi" shows in every state except ended, unknown state included
  it.each<SessionState | undefined>(['working', 'needs_input', 'idle', undefined])('shows "Interrompi" when the state is %s', (state) => {
    expect(button(render(state), 'Interrompi')).not.toBeNull();
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-31
  it('shows neither "Interrompi" nor "Termina" on an ended session', () => {
    const html = render('ended');
    expect(button(html, 'Interrompi')).toBeNull();
    expect(button(html, 'Termina')).toBeNull();
  });

  // SessionView "Shows": "Interrompi" is the .btn.label-l board button with the circle-stop icon first
  it('renders "Interrompi" as a .btn.label-l button with the circle-stop icon first', () => {
    const match = button(render('idle'), 'Interrompi');
    expect(classesOf(`<button${match?.[1] ?? ''}>`)).toEqual(expect.arrayContaining(['btn', 'label-l']));
    const inner = match?.[2] ?? '';
    const icon = renderToStaticMarkup(<CircleStopIcon />);
    expect(inner.startsWith(icon), 'the icon comes first').toBe(true);
    expect(inner.slice(icon.length).trim()).toBe('Interrompi');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-32: the panel is a region named after the folder
  it('names the terminal panel "Terminale di <folder name>", or "Terminale" without a session', () => {
    expect(render('idle')).toMatch(/<[a-z]+\b(?=[^>]*\srole="region")(?=[^>]*\saria-label="Terminale di billing-api")[^>]*>/);
    expect(render()).toMatch(/<[a-z]+\b(?=[^>]*\srole="region")(?=[^>]*\saria-label="Terminale")[^>]*>/);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-33: the hint with the keys as kbd, after the panel
  it('shows the hint "Ctrl+Maiusc+L torna all\'elenco" with three .label-m kbd keys, after the terminal panel', () => {
    const html = render('idle');
    const keys = [...html.matchAll(/<kbd\b([^>]*)>([^<]*)<\/kbd>/g)];
    expect(keys.map((k) => k[2])).toEqual(['Ctrl', 'Maiusc', 'L']);
    for (const key of keys) expect(classesOf(`<kbd${key[1]}>`)).toContain('label-m');
    expect(text(html)).toContain("Ctrl + Maiusc + L torna all'elenco");
    expect(html.indexOf('role="region"')).toBeLessThan(html.indexOf('<kbd'));
  });

  // SessionView props: `snackbar` shows after the hint
  it('shows the given snackbar after the hint, and nothing in its place without one', () => {
    const withBar = render('idle', <div role="status">avviso-snackbar</div>);
    expect(withBar).toContain('<div role="status">avviso-snackbar</div>');
    expect(text(withBar)).toMatch(/torna all'elenco avviso-snackbar$/);
    expect(text(render('idle'))).toMatch(/torna all'elenco$/);
  });
});
