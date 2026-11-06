import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NeedsInputSnackbar, nextSnackbarSession } from './NeedsInputSnackbar';
import type { SessionState, SessionSummary } from './sessions/live-session-store';

const textOf = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const session = (id: string, state: SessionState, lastActivity = '2026-11-05T10:00:00.000Z'): SessionSummary => ({
  id,
  folder: `/home/dev/progetti/${id}`,
  label: `etichetta ${id}`,
  state,
  lastActivity,
});

const before = (entries: Record<string, SessionState>) => new Map(Object.entries(entries));

describe('nextSnackbarSession', () => {
  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-13: a session that moves to needs_input is shown
  it('gives a session that was in another state and now needs input', () => {
    expect(nextSnackbarSession(before({ a: 'working' }), [session('a', 'needs_input')], null, null)).toBe('a');
  });

  // NeedsInputSnackbar contract: a session that was not in the list also starts to need input
  it('gives a session that was not in the list and arrives needing input', () => {
    expect(nextSnackbarSession(before({ a: 'idle' }), [session('a', 'idle'), session('b', 'needs_input')], null, null)).toBe('b');
  });

  // NeedsInputSnackbar contract: a session already in needs_input before the change does not start to need input
  it('gives null for a session that already needed input before the change', () => {
    expect(nextSnackbarSession(before({ a: 'needs_input' }), [session('a', 'needs_input')], null, null)).toBeNull();
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-13: the open session gives no snackbar
  it('ignores the open session when it starts to need input', () => {
    expect(nextSnackbarSession(before({ a: 'working' }), [session('a', 'needs_input')], null, 'a')).toBeNull();
  });

  // NeedsInputSnackbar rule: among several starting sessions, the one with the latest lastActivity wins
  it('gives the starting session with the latest lastActivity', () => {
    const sessions = [
      session('old', 'needs_input', '2026-11-05T10:00:00.000Z'),
      session('new', 'needs_input', '2026-11-05T10:00:05.000Z'),
      session('mid', 'needs_input', '2026-11-05T10:00:02.000Z'),
    ];
    expect(nextSnackbarSession(before({ old: 'working', new: 'idle', mid: 'working' }), sessions, null, null)).toBe('new');
  });

  // NeedsInputSnackbar rule: the open session is left out before choosing the latest starting session
  it('gives the latest starting session other than the open one', () => {
    const sessions = [session('older', 'needs_input', '2026-11-05T10:00:00.000Z'), session('open', 'needs_input', '2026-11-05T10:00:09.000Z')];
    expect(nextSnackbarSession(before({ older: 'working', open: 'working' }), sessions, null, 'open')).toBe('older');
  });

  // NeedsInputSnackbar rule: one at a time, a newer starting session replaces the one shown
  it('replaces the shown session with a session that starts to need input', () => {
    const sessions = [session('shown', 'needs_input'), session('b', 'needs_input', '2026-11-05T09:00:00.000Z')];
    expect(nextSnackbarSession(before({ shown: 'needs_input', b: 'working' }), sessions, 'shown', null)).toBe('b');
  });

  // NeedsInputSnackbar pseudocode: with no starting session the shown one stays while it still needs input and is not open
  it('keeps the shown session when nothing starts to need input', () => {
    const sessions = [session('shown', 'needs_input'), session('b', 'working')];
    expect(nextSnackbarSession(before({ shown: 'needs_input', b: 'idle' }), sessions, 'shown', null)).toBe('shown');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-15: the shown session no longer needs input
  it('gives null when the shown session no longer needs input', () => {
    expect(nextSnackbarSession(before({ shown: 'needs_input' }), [session('shown', 'working')], 'shown', null)).toBeNull();
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-15: the user opens the shown session
  it('gives null when the shown session becomes the open one', () => {
    expect(nextSnackbarSession(before({ shown: 'needs_input' }), [session('shown', 'needs_input')], 'shown', 'shown')).toBeNull();
  });

  // NeedsInputSnackbar contract: never a session that left the list
  it('gives null when the shown session left the list', () => {
    expect(nextSnackbarSession(before({ shown: 'needs_input', b: 'idle' }), [session('b', 'idle')], 'shown', null)).toBeNull();
  });

  // NeedsInputSnackbar pseudocode: no starting session and no shown session
  it('gives null when nothing is shown and nothing starts to need input', () => {
    expect(nextSnackbarSession(before({ a: 'working' }), [session('a', 'idle')], null, null)).toBeNull();
  });
});

describe('NeedsInputSnackbar', () => {
  const render = (folder: string) =>
    renderToStaticMarkup(<NeedsInputSnackbar session={{ ...session('a', 'needs_input'), folder }} onOpen={() => {}} />);

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-13: "<progetto> richiede il tuo input" with "Apri", as a status
  it('shows "<progetto> richiede il tuo input" and the button "Apri" in a role="status" box', () => {
    const html = render('/home/dev/progetti/web-dashboard');
    expect(html).toMatch(/^<\w+[^>]*role="status"/);
    const buttons = [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map((m) => textOf(m[1] ?? ''));
    expect(buttons).toEqual(['Apri']);
    expect(textOf(html.replace(/<button\b[\s\S]*?<\/button>/g, ''))).toBe('web-dashboard richiede il tuo input');
  });

  // NeedsInputSnackbar "Shows": "<progetto>" is the last segment of the folder, in bold
  it('shows only the last folder segment, in bold', () => {
    const html = render('/srv/clienti/billing-api');
    expect(html).toMatch(/<b>billing-api<\/b>/);
    expect(html).not.toContain('/srv/clienti');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-41: the box is the glass toast
  it('draws the box with the .vx-glass class', () => {
    expect(render('/p/web-dashboard')).toMatch(/^<\w+\b[^>]*class="[^"]*\bvx-glass\b/);
  });
});
