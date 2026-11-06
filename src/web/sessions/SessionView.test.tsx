import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SessionState } from './live-session-store';
import { SessionView } from './SessionView';

/** The visible text: the tokens tooltip shows only on hover or focus. */
const text = (html: string) =>
  html.replace(/<span[^>]*role="tooltip"[^>]*>(<span[^>]*>(<span[^>]*>[^<]*<\/span>)*<\/span>)*<\/span>/g, '').replace(/<[^>]*>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
const classesOf = (tag: string) => tag.match(/\sclass="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];
const FOLDER = '/home/dev/progetti/billing-api';
const usage = { context: { used: 45_200, window: 200_000 }, tokens: { input: 1_000, output: 2_000, cacheWrite: 3_000, cacheRead: 4_000 }, cost: { usd: 1.27, incomplete: false } };
const sessionIn = (state: SessionState) => ({ folder: FOLDER, label: 'Etichetta', state, usage });
const render = (state?: SessionState) =>
  renderToStaticMarkup(<SessionView sessionId="s1" session={state ? sessionIn(state) : undefined} onLeaveTerminal={() => {}} />);
const button = (html: string, name: string) => html.match(new RegExp(`<button\\b([^>]*)>((?:(?!</button>)[\\s\\S])*${name}\\s*)</button>`));
const partOf = (html: string, tag: 'header' | 'footer') => html.match(new RegExp(`<${tag}\\b[\\s\\S]*</${tag}>`))?.[0] ?? '';
const accessibleNames = (html: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => m[1]?.match(/\saria-label="([^"]*)"/)?.[1] ?? text(m[2]!).replace(/^■ /, ''));

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

  // plan-session_list_width/REQ-15: the header actions are "Search", "Interrupt" and "Terminate", in this order
  it('shows only "Search", "Interrupt" and "Terminate" as header actions', () => {
    expect(accessibleNames(partOf(render('idle'), 'header'))).toEqual(['Search', 'Interrupt', 'Terminate']);
  });

  // plan-terminal_addons/REQ-35, REQ-43, plan-session_list_width/REQ-29: the zoom controls show the page size in every state, at the end of the footer
  it.each<SessionState | undefined>(['working', 'needs_input', 'idle', 'ended', undefined])('shows the zoom controls at the end of the footer when the state is %s', (state) => {
    const html = render(state);
    const footer = partOf(html, 'footer');
    expect(partOf(html, 'header')).not.toContain('aria-label="Terminal text size"');
    expect(footer).toContain('aria-label="Terminal text size"');
    expect(button(footer, '12 px')?.[1]).toContain('aria-label="Default text size (12 px)"');
    expect(accessibleNames(footer).slice(-3)).toEqual(['Smaller text', 'Default text size (12 px)', 'Larger text']);
    expect(text(footer)).toMatch(/12 px$/);
  });

  // plan-session_list_width/REQ-19, REQ-20: the footer under the panel shows the path and the figures; the header shows neither
  it('shows the path and the figures of the session in the footer, after the terminal panel', () => {
    const html = render('idle');
    const footer = partOf(html, 'footer');
    expect(html.indexOf('role="region"')).toBeLessThan(html.indexOf('<footer'));
    expect(text(footer)).toMatch(new RegExp(`^${FOLDER} Context 45\\.2k / 200k · 23% 10k tokens \\$1\\.27 `));
    expect(text(partOf(html, 'header'))).not.toMatch(new RegExp(`${FOLDER}|Context|tokens|\\$`));
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

  // plan-session_list_width, assumption "Key hint": no on-screen hint for Ctrl+Shift+L
  it('shows no key hint', () => {
    const html = render('idle');
    expect(html).not.toContain('<kbd');
    expect(text(html)).not.toContain('back to the list');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-42: the view holds no snackbar slot; the footer ends the view
  it('ends with the footer', () => {
    expect(render('idle')).toMatch(/<\/footer>(<\/\w+>)*$/);
  });
});
