import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CircleXIcon, LoaderCircleIcon, TerminalIcon } from '../icons/Icons';
import type { LoadStatus, SessionState, SessionSummary } from './live-session-store';
import { SessionList } from './SessionList';
import { StateBadge } from './StateBadge';

interface Entry {
  attributes: string;
  html: string;
  text: string;
}

const EXTERNAL_TOOLTIP = 'Sessione in un altro terminale: lo stato «Richiede input» non è disponibile';

const pad = (n: number) => String(n).padStart(2, '0');
const localTime = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
const textOf = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

function entries(html: string): Entry[] {
  return [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attributes: m[1] ?? '', html: m[2] ?? '', text: textOf(m[2] ?? '') }));
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
    expect(textOf(html)).toContain('Nessuna sessione.');
    expect(entries(html)).toEqual([]);
  });

  // SessionList "Description": not a landmark, the list panel of AppLayout carries the label "Elenco sessioni"
  it('is not a landmark and carries no "Elenco sessioni" label', () => {
    for (const html of [renderList([]), renderList([session('a', 'idle', now)])]) {
      expect(html).not.toMatch(/^<(?:nav|section|aside|main)\b/);
      expect(html).not.toMatch(/^<\w+[^>]*\srole="(?:navigation|region|complementary)"/);
      expect(html).not.toContain('Elenco sessioni');
    }
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

  // plan-claude_sessions_client/REQ-29, REQ-30, plan-claude_sessions_client-ui_redesign/REQ-15: an external entry is marked "Esterna" with an icon, with a tooltip on the missing state
  it('marks an external entry with the class external and the "Esterna" marker with its tooltip', () => {
    const html = renderList([session('hosted', 'idle', earlier), { ...session('outside', 'working', now, 'Rifattorizza'), external: true }]);
    const [outside, hosted] = entries(html);
    expect(outside?.text).toContain('/home/dev/progetti/outside');
    expect(outside?.text).toContain('Esterna');
    expect(outside?.text).toContain('Rifattorizza');
    expect(outside?.text).toContain('In lavorazione');
    expect(outside?.attributes).toMatch(/class="[^"]*\bexternal\b/);
    const mark = new RegExp(`<(\\w+)\\b[^>]*title="${EXTERNAL_TOOLTIP}"[^>]*>\\s*([\\s\\S]*?)\\s*Esterna\\s*</\\1>`);
    const [, , icon] = outside?.html.match(mark) ?? [];
    expect(icon, 'mark with the tooltip whose text is "Esterna"').toBeDefined();
    expect(icon, 'terminal icon before "Esterna"').toBe(renderToStaticMarkup(<TerminalIcon />));
    expect(hosted?.text).not.toContain('Esterna');
    expect(hosted?.attributes).not.toMatch(/\bexternal\b/);
  });

  // plan-claude_sessions_client-ui_redesign/REQ-11: label, state, folder, mark and time always in the same order
  it('shows label, state, folder, "Esterna" mark and time in this order in every entry', () => {
    const sessions: SessionSummary[] = [session('hosted', 'working', now, 'Scrivi i test'), { ...session('outside', 'idle', earlier, 'Leggi i log'), external: true }];
    const [hosted, outside] = entries(renderList(sessions));
    const positions = (entry: Entry | undefined, parts: string[]) => parts.map((part) => entry?.text.indexOf(part) ?? -1);
    const hostedOrder = positions(hosted, ['Scrivi i test', 'In lavorazione', '/home/dev/progetti/hosted', localTime(now)]);
    expect(hostedOrder.every((p) => p >= 0)).toBe(true);
    expect(hostedOrder).toEqual([...hostedOrder].sort((a, b) => a - b));
    const outsideOrder = positions(outside, ['Leggi i log', 'In attesa', '/home/dev/progetti/outside', 'Esterna', localTime(earlier)]);
    expect(outsideOrder.every((p) => p >= 0)).toBe(true);
    expect(outsideOrder).toEqual([...outsideOrder].sort((a, b) => a - b));
  });

  // plan-claude_sessions_client-ui_redesign/REQ-12: the state of each entry is a StateBadge
  it('shows the StateBadge of the session state in each entry', () => {
    const states: SessionState[] = ['working', 'needs_input', 'idle', 'ended'];
    for (const state of states) {
      const [entry] = entries(renderList([session('s', state, now)]));
      expect(entry?.html, state).toContain(renderToStaticMarkup(<StateBadge state={state} />));
    }
  });

  // SessionList: a long label or folder has its full value as tooltip
  it('gives the label and the folder their full value as tooltip', () => {
    const label = `Riscrivi il modulo di autenticazione ${'e aggiorna la documentazione '.repeat(5)}`.trim();
    const folder = `/home/dev/${'cartella-molto-lunga/'.repeat(8)}progetto`;
    const [entry] = entries(renderList([{ ...session('long', 'idle', now, label), folder }]));
    expect(entry?.html).toMatch(new RegExp(`<\\w+\\b[^>]*title="${label}"[^>]*>\\s*${label}\\s*<`));
    expect(entry?.html).toMatch(new RegExp(`<\\w+\\b[^>]*title="${folder}"[^>]*>\\s*${folder}\\s*<`));
  });

  // plan-claude_sessions_client-ui_redesign/REQ-16: an open entry in needs input keeps both marks
  it('keeps the needs-input class and aria-current on an open entry in needs input', () => {
    const [asking, other] = entries(renderList([session('asking', 'needs_input', now), session('other', 'idle', earlier)], 'asking'));
    expect(asking?.attributes).toMatch(/class="[^"]*\bneeds-input\b/);
    expect(asking?.attributes).toContain('aria-current="true"');
    expect(other?.attributes).not.toContain('aria-current');
  });

  describe('load status', () => {
    const LOST = 'Connessione al server persa. Ricarica la pagina.';
    const renderWith = (sessions: SessionSummary[], status: LoadStatus) =>
      renderToStaticMarkup(<SessionList sessions={sessions} openSessionId={null} onOpen={() => {}} status={status} />);
    const roleText = (html: string, role: string) =>
      [...html.matchAll(new RegExp(`<([a-z]+)\\b[^>]*\\srole="${role}"[^>]*>([\\s\\S]*?)</\\1>`, 'g'))].map((m) => textOf(m[2] ?? ''));

    // plan-claude_sessions_client-ui_redesign/REQ-29, SessionList: a loading indicator in place of "Nessuna sessione."
    it('while loading shows the status "Caricamento…" and not "Nessuna sessione."', () => {
      const html = renderWith([], 'loading');
      expect(roleText(html, 'status')).toEqual(['Caricamento…']);
      expect(textOf(html)).not.toContain('Nessuna sessione.');
      expect(html).toContain(renderToStaticMarkup(<LoaderCircleIcon />));
    });

    // plan-claude_sessions_client-ui_redesign/REQ-29, SessionList: the indicator takes the place of the entries
    it('while loading shows the indicator and no entry, even with sessions', () => {
      const html = renderWith([session('a', 'idle', now)], 'loading');
      expect(roleText(html, 'status')).toEqual(['Caricamento…']);
      expect(entries(html)).toEqual([]);
    });

    // plan-claude_sessions_client-ui_redesign/REQ-30, SessionList: lost connection with no session shows only the error
    it('on error with no session shows only the alert "Connessione al server persa. Ricarica la pagina."', () => {
      const html = renderWith([], 'error');
      expect(roleText(html, 'alert')).toEqual([LOST]);
      expect(html).toContain(renderToStaticMarkup(<CircleXIcon />));
      expect(textOf(html)).not.toContain('Nessuna sessione.');
      expect(html).not.toContain('role="status"');
    });

    // plan-claude_sessions_client-ui_redesign/REQ-30, SessionList: the error shows above the entries already received
    it('on error keeps the entries received, below the alert', () => {
      const html = renderWith([session('a', 'idle', now), session('b', 'working', earlier)], 'error');
      expect(entries(html)).toHaveLength(2);
      expect(html.indexOf('role="alert"')).toBeGreaterThan(-1);
      expect(html.indexOf('role="alert"')).toBeLessThan(html.indexOf('<button'));
    });

    // SessionList: status defaults to ready
    it('with no status behaves as ready', () => {
      expect(renderList([])).toBe(renderWith([], 'ready'));
      expect(renderWith([], 'ready')).not.toMatch(/role="(status|alert)"/);
    });
  });
});
