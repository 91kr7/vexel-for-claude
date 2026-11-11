import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SessionState, SessionSummary } from './live-session-store';
import { SessionList } from './SessionList';

const session = (id: string, state: SessionState, extra: Partial<SessionSummary> = {}): SessionSummary => ({
  id,
  folder: `/home/dev/${id}`,
  label: `Label of ${id}`,
  state,
  lastActivity: new Date().toISOString(),
  ...extra,
});

const items = (html: string) => [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((m) => m[1] ?? '');
const buttonsOf = (html: string) =>
  [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => {
    const attributes = m[1] ?? '';
    const name = attributes.match(/\saria-label="([^"]*)"/)?.[1] ?? (m[2] ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return /\bsession-entry\b/.test(attributes.match(/\sclass="([^"]*)"/)?.[1] ?? '') ? 'entry' : name;
  });
const render = (sessions: SessionSummary[]) => renderToStaticMarkup(<SessionList sessions={sessions} openSessionId={null} onOpen={() => {}} />);
const indicators = (html: string) => html.match(/<span\b[^>]*\srole="img"[^>]*\saria-label="Favorite"/g)?.length ?? 0;

const FAVORITE_BUTTON = /^(?:Mark as Favorite|Remove Favorite)$/;

describe('SessionList favorite', () => {
  // plan-favorite_session/REQ-2: every entry, hosted or external, in any state, has the favorite button
  it.each([
    ['hosted idle', session('a', 'idle')],
    ['hosted working', session('a', 'working')],
    ['hosted needs-input card', session('a', 'needs_input')],
    ['hosted ended', session('a', 'ended')],
    ['external idle', session('a', 'idle', { external: true })],
    ['external working', session('a', 'working', { external: true })],
    ['external needs input', session('a', 'needs_input', { external: true })],
  ])('shows one "Mark as Favorite" button and no indicator on an unmarked %s entry', (_, summary) => {
    const [item] = items(render([summary]));
    expect(buttonsOf(item ?? '').filter((name) => FAVORITE_BUTTON.test(name))).toEqual(['Mark as Favorite']);
    expect(indicators(item ?? '')).toBe(0);
  });

  // plan-favorite_session/REQ-3: a marked entry shows the indicator in every group, and the button turns into "Remove Favorite"
  it.each([
    ['needs-input card', session('a', 'needs_input', { favorite: true })],
    ['running row', session('a', 'working', { favorite: true })],
    ['idle row', session('a', 'idle', { favorite: true })],
    ['ended row', session('a', 'ended', { favorite: true })],
    ['external row', session('a', 'idle', { external: true, favorite: true })],
  ])('shows the indicator and "Remove Favorite" on a marked %s', (_, summary) => {
    const [item] = items(render([summary]));
    expect(indicators(item ?? '')).toBe(1);
    expect(buttonsOf(item ?? '').filter((name) => FAVORITE_BUTTON.test(name))).toEqual(['Remove Favorite']);
  });

  it('shows the indicator only on the marked entries', () => {
    const html = render([session('a', 'idle', { favorite: true }), session('b', 'idle'), session('c', 'ended', { favorite: true })]);
    expect(items(html).map(indicators).sort()).toEqual([0, 1, 1]);
  });

  // plan-favorite_session/REQ-3: the indicator comes after the folder name of the entry
  it('puts the indicator after the folder name of the entry', () => {
    const [item] = items(render([session('a', 'idle', { favorite: true })]));
    expect((item ?? '').indexOf('title="/home/dev/a"')).toBeGreaterThan(-1);
    expect((item ?? '').indexOf('aria-label="Favorite"')).toBeGreaterThan((item ?? '').indexOf('title="/home/dev/a"'));
  });

  // plan-favorite_session/REQ-9: marking changes neither the order nor the group
  it('keeps the same order of the entries with and without the mark', () => {
    const plain = [session('a', 'idle'), session('b', 'idle'), session('c', 'idle')];
    const marked = plain.map((s) => (s.id === 'b' ? { ...s, favorite: true as const } : s));
    const order = (html: string) => [...html.matchAll(/title="\/home\/dev\/([a-z])"/g)].map((m) => m[1]);
    expect(order(render(marked))).toEqual(order(render(plain)));
    expect(render(marked).match(/class="section-label session-group-heading[^"]*"/g)).toEqual(
      render(plain).match(/class="section-label session-group-heading[^"]*"/g),
    );
  });

  // SessionList spec (tab order): entry, EndedEntryActions, Favorite button, "Rename"
  it('orders the buttons: entry, "Resume", "Dismiss", the favorite button, "Rename"', () => {
    const [item] = items(render([session('a', 'ended', { resumable: true })]));
    expect(buttonsOf(item ?? '')).toEqual(['entry', 'Resume', 'Dismiss', 'Mark as Favorite', 'Rename']);
  });

  it('puts the favorite button before "Rename" on a running entry', () => {
    const [item] = items(render([session('a', 'working')]));
    expect(buttonsOf(item ?? '')).toEqual(['entry', 'Mark as Favorite', 'Rename']);
  });
});
