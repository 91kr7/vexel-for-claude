import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SessionState, SessionSummary } from './live-session-store';
import { SessionList } from './SessionList';

interface Entry {
  attributes: string;
  text: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const localTime = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
const textOf = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

function entries(html: string): Entry[] {
  return [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attributes: m[1] ?? '', text: textOf(m[2] ?? '') }));
}

const session = (id: string, state: SessionState, lastActivity: Date, label = `etichetta ${id}`): SessionSummary => ({
  id,
  folder: `/home/dev/progetti/${id}`,
  label,
  state,
  lastActivity: lastActivity.toISOString(),
});

const renderList = (sessions: SessionSummary[], openSessionId: string | null = null) =>
  renderToStaticMarkup(<SessionList sessions={sessions} openSessionId={openSessionId} onOpen={() => {}} />);

describe('SessionList', () => {
  const now = new Date();
  const earlier = new Date(now.getTime() - 1000);

  // plan-claude_sessions_client/REQ-11: empty list
  it('shows "Nessuna sessione." and no entry when there is no session', () => {
    const html = renderList([]);
    expect(html).toMatch(/^<nav/);
    expect(textOf(html)).toContain('Nessuna sessione.');
    expect(entries(html)).toEqual([]);
  });

  // plan-claude_sessions_client/REQ-11, REQ-12: one entry per session with label, folder, state name and last activity
  it('shows one entry per session with label, full folder, state name and local time HH:MM:SS', () => {
    const sessions = [session('alpha', 'idle', now, 'Correggi il login')];
    const [entry] = entries(renderList(sessions));
    expect(entry?.text).toContain('Correggi il login');
    expect(entry?.text).toContain('/home/dev/progetti/alpha');
    expect(entry?.text).toContain('In attesa');
    expect(entry?.text).toContain(localTime(now));
    expect(entry?.text).not.toContain(String(now.getFullYear()));
  });

  // plan-claude_sessions_client/REQ-12: Italian state names
  it('names the states in Italian', () => {
    const states: [SessionState, string][] = [
      ['working', 'In lavorazione'],
      ['needs_input', 'Richiede input'],
      ['idle', 'In attesa'],
      ['ended', 'Terminata'],
    ];
    for (const [state, name] of states) {
      const [entry] = entries(renderList([session('s', state, now)]));
      expect(entry?.text, state).toContain(name);
    }
  });

  // plan-claude_sessions_client/REQ-12: on another day the date comes before the time
  it('shows the date before the time when the last activity is on another day', () => {
    const otherDay = new Date(now.getFullYear() - 1, 2, 17, 9, 8, 7);
    const [entry] = entries(renderList([session('old', 'ended', otherDay)]));
    const time = '09:08:07';
    expect(entry?.text).toContain(time);
    const beforeTime = entry?.text.slice(0, entry.text.indexOf(time)) ?? '';
    expect(beforeTime).toContain('17');
    expect(beforeTime).toContain(String(otherDay.getFullYear()));
  });

  // plan-claude_sessions_client/REQ-16: needs input first and highlighted, then most recent activity
  it('orders needs input first, then most recent activity, and highlights only needs input', () => {
    const html = renderList([
      session('old-idle', 'idle', earlier),
      session('new-working', 'working', now),
      session('asking', 'needs_input', earlier),
    ]);
    const list = entries(html);
    expect(list.map((e) => e.text.match(/\/home\/dev\/progetti\/([\w-]+)/)?.[1])).toEqual(['asking', 'new-working', 'old-idle']);
    expect(list.map((e) => /class="[^"]*\bneeds-input\b/.test(e.attributes))).toEqual([true, false, false]);
  });

  // plan-claude_sessions_client/REQ-18: the open session's entry is marked current
  it('marks only the open session with aria-current="true"', () => {
    const html = renderList([session('a', 'idle', earlier), session('b', 'idle', now)], 'a');
    const list = entries(html);
    const current = list.filter((e) => e.attributes.includes('aria-current="true"'));
    expect(current).toHaveLength(1);
    expect(current[0]?.text).toContain('/home/dev/progetti/a');
  });

  // plan-claude_sessions_client/REQ-22: ten sessions, ten entries
  it('shows an entry for each of ten sessions', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => session(`s${i}`, i % 3 === 0 ? 'needs_input' : 'working', now));
    expect(entries(renderList(sessions))).toHaveLength(10);
  });
});
