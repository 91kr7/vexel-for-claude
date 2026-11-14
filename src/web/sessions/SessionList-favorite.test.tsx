// @vitest-environment jsdom
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

const render = (sessions: SessionSummary[]) => renderToStaticMarkup(<SessionList sessions={sessions} openSessionId={null} onOpen={() => {}} />);
/** The list items of the rendered list, as DOM elements. */
const items = (sessions: SessionSummary[]) => {
  const host = document.createElement('div');
  host.innerHTML = render(sessions);
  return [...host.querySelectorAll('li')];
};
const FAVORITE = /^(?:Mark as Favorite|Remove Favorite)$/;
const stars = (root: Element) => [...root.querySelectorAll('button')].filter((b) => FAVORITE.test(b.getAttribute('aria-label') ?? ''));
const entryOf = (root: Element) => root.querySelector('.session-entry')!;
/** Each button in document (tab) order: "entry" for the entry button, else its accessible name. */
const tabOrder = (root: Element) =>
  [...root.querySelectorAll('button')].map((b) => (b.classList.contains('session-entry') ? 'entry' : (b.getAttribute('aria-label') ?? b.textContent?.trim())));
const indicators = (root: Element) => root.querySelectorAll('[role="img"][aria-label="Favorite"]').length;

const ALL_ENTRIES: [string, SessionSummary][] = [
  ['hosted idle row', session('a', 'idle')],
  ['hosted working row', session('a', 'working')],
  ['hosted needs-input card', session('a', 'needs_input')],
  ['hosted ended row', session('a', 'ended')],
  ['external idle row', session('a', 'idle', { external: true })],
  ['external working row', session('a', 'working', { external: true })],
  ['external needs-input row', session('a', 'needs_input', { external: true })],
  ['external ended row', session('a', 'ended', { external: true })],
];

describe('SessionList session star', () => {
  // plan-favorite_session/REQ-2, plan-ui_restyle/REQ-29, REQ-32: one star per entry, a sibling right after the entry button, never inside it
  it.each(ALL_ENTRIES)('puts one "Mark as Favorite" star right after the entry button of an unmarked %s', (_, summary) => {
    const [item] = items([summary]);
    const found = stars(item!);
    expect(found.map((b) => b.getAttribute('aria-label'))).toEqual(['Mark as Favorite']);
    expect(entryOf(item!).contains(found[0]!)).toBe(false);
    expect(entryOf(item!).nextElementSibling).toBe(found[0]);
  });

  // plan-ui_restyle/REQ-29, REQ-32: the line 1 of the entry keeps the star place right after the folder name
  it.each(ALL_ENTRIES)('keeps the star place right after the folder name on the %s', (_, summary) => {
    const [item] = items([summary]);
    const name = entryOf(item!).querySelector('[title="/home/dev/a"]')!;
    expect(name).not.toBeNull();
    expect(name.nextElementSibling?.classList.contains('session-entry-star-slot')).toBe(true);
    expect(name.nextElementSibling?.getAttribute('aria-hidden')).toBe('true');
  });

  // plan-ui_restyle/REQ-33, plan-favorite_session/REQ-3: a marked entry has "Remove Favorite", filled, in every group
  it.each(ALL_ENTRIES.map(([name, s]): [string, SessionSummary] => [name, { ...s, favorite: true }]))('shows a marked "Remove Favorite" star on a marked %s', (_, summary) => {
    const [item] = items([summary]);
    const found = stars(item!);
    expect(found.map((b) => b.getAttribute('aria-label'))).toEqual(['Remove Favorite']);
    expect(found[0]!.classList.contains('marked')).toBe(true);
    expect(entryOf(item!).nextElementSibling).toBe(found[0]);
  });

  // plan-ui_restyle/REQ-29: the FavoriteIndicator is gone from the session list, the star alone shows the mark
  it('shows no FavoriteIndicator in the list, marked or not', () => {
    const list = items([session('a', 'idle', { favorite: true }), session('b', 'needs_input', { favorite: true }), session('c', 'ended')]);
    expect(list.map(indicators)).toEqual([0, 0, 0]);
  });

  // plan-favorite_session/REQ-9, plan-ui_restyle/REQ-33: marking changes neither the order nor the group
  it('keeps the same order and groups of the entries with and without the mark', () => {
    const plain = [session('a', 'idle'), session('b', 'idle'), session('c', 'idle')];
    const marked = plain.map((s) => (s.id === 'b' ? { ...s, favorite: true as const } : s));
    const order = (html: string) => [...html.matchAll(/title="\/home\/dev\/([a-z])"/g)].map((m) => m[1]);
    expect(order(render(marked))).toEqual(order(render(plain)));
    expect(render(marked).match(/class="section-label session-group-heading[^"]*"/g)).toEqual(
      render(plain).match(/class="section-label session-group-heading[^"]*"/g),
    );
  });

  // SessionList spec "Session star", plan-ui_restyle/REQ-31: Tab follows the new visual order, "Rename" last
  it.each([
    ['ended row', session('a', 'ended', { resumable: true }), ['entry', 'Mark as Favorite', 'Resume', 'Dismiss', 'Rename']],
    ['working row', session('a', 'working'), ['entry', 'Mark as Favorite', 'Rename']],
    ['external needs-input row', session('a', 'needs_input', { external: true }), ['entry', 'Mark as Favorite', 'Rename']],
    ['needs-input card', session('a', 'needs_input'), ['entry', 'Mark as Favorite', 'Reply', 'Rename']],
  ])('orders the buttons of a %s', (_, summary, expected) => {
    const [item] = items([summary]);
    expect(tabOrder(item!)).toEqual(expected);
  });

  // plan-ui_restyle/REQ-32: the star of the needs-input card sits inside the card
  it('puts the star of the needs-input card inside the card', () => {
    const [item] = items([session('a', 'needs_input')]);
    const card = item!.querySelector('.session-card')!;
    expect(card).not.toBeNull();
    expect(stars(card)).toHaveLength(1);
  });
});
