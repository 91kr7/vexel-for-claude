import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SessionState } from './live-session-store';
import { SessionView } from './SessionView';

const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
const classesOf = (tag: string) => tag.match(/\sclass="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];
const sessionIn = (state: SessionState) => ({ folder: '/home/dev/progetti/billing-api', label: 'Etichetta', state });
const render = (state?: SessionState) =>
  renderToStaticMarkup(<SessionView sessionId="s1" session={state ? sessionIn(state) : undefined} onLeaveTerminal={() => {}} />);
const button = (html: string, name: string) => html.match(new RegExp(`<button\\b([^>]*)>((?:(?!</button>)[\\s\\S])*${name}\\s*)</button>`));

describe('SessionView', () => {
  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-29, REQ-31: "Interrupt" shows in every state except ended, unknown state included
  it.each<SessionState | undefined>(['working', 'needs_input', 'idle', undefined])('shows "Interrupt" when the state is %s', (state) => {
    expect(button(render(state), 'Interrupt')).not.toBeNull();
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-31
  it('shows neither "Interrupt" nor "Terminate" on an ended session', () => {
    const html = render('ended');
    expect(button(html, 'Interrupt')).toBeNull();
    expect(button(html, 'Terminate')).toBeNull();
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-32: "Interrupt" is the rose .button-danger with the decorative "■" first
  it('renders "Interrupt" as a .button-danger button with a decorative "■" before its name', () => {
    const match = button(render('idle'), 'Interrupt');
    expect(classesOf(`<button${match?.[1] ?? ''}>`)).toContain('button-danger');
    const inner = match?.[2] ?? '';
    expect(inner).toMatch(/^<\w+\b[^>]*aria-hidden="true"[^>]*>■<\/\w+>\s*Interrupt\s*$/);
  });

  // plan-terminal_addons/REQ-15: "Search" shows in every state, ended included, before "Interrupt"
  it.each<SessionState | undefined>(['working', 'needs_input', 'idle', 'ended', undefined])('shows the "Search" icon button when the state is %s', (state) => {
    const html = render(state);
    const tag = html.match(/<button\b[^>]*\saria-label="Search"[^>]*>/)?.[0];
    expect(tag).toBeDefined();
    expect(tag).toContain('title="Search (Ctrl+Shift+F)"');
    const interrupt = button(html, 'Interrupt');
    if (interrupt) expect(html.indexOf(tag!)).toBeLessThan(html.indexOf(interrupt[0]));
  });

  // SessionView: the search box shows only once the search is opened
  it('does not show the search box before the search is opened', () => {
    expect(render('idle')).not.toContain('role="search"');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-32: the panel is a region named after the folder
  it('names the terminal panel "Terminal: <folder name>", or "Terminal" without a session', () => {
    expect(render('idle')).toMatch(/<[a-z]+\b(?=[^>]*\srole="region")(?=[^>]*\saria-label="Terminal: billing-api")[^>]*>/);
    expect(render()).toMatch(/<[a-z]+\b(?=[^>]*\srole="region")(?=[^>]*\saria-label="Terminal")[^>]*>/);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-35: the hint with the keys in .kbd-badge, after the panel
  it('shows the hint "Ctrl+Shift+L back to the list" with three .kbd-badge keys, after the terminal panel', () => {
    const html = render('idle');
    const keys = [...html.matchAll(/<kbd\b([^>]*)>([^<]*)<\/kbd>/g)];
    expect(keys.map((k) => k[2])).toEqual(['Ctrl', 'Shift', 'L']);
    for (const key of keys) expect(classesOf(`<kbd${key[1]}>`)).toContain('kbd-badge');
    expect(text(html)).toContain("Ctrl + Shift + L back to the list");
    expect(html.indexOf('role="region"')).toBeLessThan(html.indexOf('<kbd'));
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-42: the view holds no snackbar slot; the hint ends the view
  it('ends with the hint', () => {
    expect(text(render('idle'))).toMatch(/back to the list$/);
  });
});
