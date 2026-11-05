import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CircleXIcon, LoaderCircleIcon, TerminalIcon } from '../icons/Icons';
import type { LoadStatus, SessionState, SessionSummary } from './live-session-store';
import { ProgressBar } from './ProgressBar';
import { SessionList } from './SessionList';
import { StateBadge } from './StateBadge';

const textOf = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
const classesOf = (tag: string) => tag.match(/\sclass="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];

interface Button {
  attributes: string;
  html: string;
  text: string;
}

function buttonsIn(html: string): Button[] {
  return [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attributes: m[1] ?? '', html: m[2] ?? '', text: textOf(m[2] ?? '') }));
}

const entries = (html: string) => buttonsIn(html).filter((b) => classesOf(b.attributes).includes('session-entry'));
const items = (html: string) => [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((m) => m[1] ?? '');
const headings = (html: string) => [...html.matchAll(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/g)].map((m) => ({ classes: classesOf(m[1] ?? ''), text: textOf(m[2] ?? '') }));

/** The html of each group, keyed by its heading text: from one h2 to the next. */
function groupsOf(html: string): Map<string, string> {
  const parts = html.split(/(?=<h2\b)/).slice(1);
  return new Map(parts.map((part) => [textOf(part.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? ''), part]));
}

const folderOf = (id: string) => `/home/dev/progetti/${id}`;

const session = (id: string, state: SessionState, lastActivity: Date, label = `etichetta ${id}`): SessionSummary => ({
  id,
  folder: folderOf(id),
  label,
  state,
  lastActivity: lastActivity.toISOString(),
});

const external = (id: string, state: SessionState, lastActivity: Date, label?: string): SessionSummary => ({ ...session(id, state, lastActivity, label), external: true });

const renderList = (sessions: SessionSummary[], openSessionId: string | null = null) =>
  renderToStaticMarkup(<SessionList sessions={sessions} openSessionId={openSessionId} onOpen={() => {}} />);

const avatarTag = (html: string) => html.match(/<\w+\b[^>]*\sclass="[^"]*\bavatar\b[^"]*"[^>]*>/)?.[0] ?? '';
const titled = (html: string, value: string) => new RegExp(`<\\w+\\b[^>]*\\stitle="${value}"[^>]*>\\s*([^<]*?)\\s*<`).exec(html)?.[1];
const terminalPath = renderToStaticMarkup(<TerminalIcon />).match(/<path\b[^>]*>/)?.[0] ?? '<missing terminal path>';

describe('SessionList', () => {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60_000);
  const earlier = new Date(now.getTime() - 20 * 60_000);

  // plan-claude_sessions_client/REQ-11: empty list
  it('shows "Nessuna sessione." and no entry when there is no session', () => {
    const html = renderList([]);
    expect(textOf(html)).toContain('Nessuna sessione.');
    expect(buttonsIn(html)).toEqual([]);
    expect(headings(html)).toEqual([]);
  });

  // SessionList "Description": not a landmark, the list panel of AppLayout carries the label "Elenco sessioni"
  it('is not a landmark and carries no "Elenco sessioni" label', () => {
    for (const html of [renderList([]), renderList([session('a', 'idle', now)])]) {
      expect(html).not.toMatch(/^<(?:nav|section|aside|main)\b/);
      expect(html).not.toMatch(/^<\w+[^>]*\srole="(?:navigation|region|complementary)"/);
      expect(html).not.toContain('Elenco sessioni');
    }
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-16: the four groups in order, as level-2 .label-l headings
  it('shows the four group headings in order, as level-2 .label-l headings', () => {
    const html = renderList([
      session('ended', 'ended', now),
      external('outside', 'working', now),
      session('hosted', 'idle', now),
      session('asking', 'needs_input', now),
    ]);
    expect(headings(html).map((h) => h.text)).toEqual(['Richiedono input', 'In corso', 'In altri terminali', 'Terminate']);
    for (const heading of headings(html)) expect(heading.classes, heading.text).toContain('label-l');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-16: an empty group is hidden
  it('hides the heading of an empty group', () => {
    expect(headings(renderList([session('a', 'working', now)])).map((h) => h.text)).toEqual(['In corso']);
    expect(headings(renderList([external('x', 'idle', now), session('z', 'ended', now)])).map((h) => h.text)).toEqual(['In altri terminali', 'Terminate']);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-17, REQ-18: each session sits in its group, latest activity first
  it('puts each session in its group, the latest activity first', () => {
    const html = renderList([
      session('h-idle', 'idle', earlier),
      session('h-working', 'working', now),
      external('e-asking', 'needs_input', now),
      session('h-asking', 'needs_input', earlier),
      external('e-working', 'working', earlier),
      external('e-idle', 'idle', now),
      session('h-ended', 'ended', now),
      external('e-ended', 'ended', earlier),
    ]);
    const groups = groupsOf(html);
    const namesIn = (title: string) => items(groups.get(title) ?? '').map((item) => titled(item, '/home/dev/progetti/[\\w-]+') ?? '?');
    expect(namesIn('Richiedono input')).toEqual(['e-asking', 'h-asking']);
    expect(namesIn('In corso')).toEqual(['h-working', 'h-idle']);
    expect(namesIn('In altri terminali')).toEqual(['e-idle', 'e-working']);
    expect(namesIn('Terminate')).toEqual(['h-ended', 'e-ended']);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-19: avatar, folder name, label, state and time, in this order
  it('shows the avatar initials, the folder name, the label, the state and the relative time, in this order', () => {
    const [entry] = entries(renderList([{ ...session('web-dashboard', 'idle', fiveMinutesAgo, 'Correggi il login') }]));
    expect(entry?.html.match(/<\w+\b[^>]*\sclass="[^"]*\bavatar\b[^"]*"[^>]*>([^<]*)</)?.[1]).toBe('WD');
    const parts = ['WD', 'web-dashboard', 'Correggi il login', 'In attesa', '5 min fa'];
    const positions = parts.map((part) => entry?.text.indexOf(part) ?? -1);
    expect(positions.every((p) => p >= 0), `${entry?.text}`).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(entry?.text).not.toContain('/home/dev/progetti');
    expect(entry?.html).toMatch(new RegExp(`<time\\b[^>]*\\sdateTime="${fiveMinutesAgo.toISOString()}"[^>]*>5 min fa</time>`, 'i'));
  });

  // SessionList "Entry row": folder name and label carry their full value as tooltip
  it('gives the folder name the full path and the label the full label as tooltip', () => {
    const label = `Riscrivi il modulo di autenticazione ${'e aggiorna la documentazione '.repeat(5)}`.trim();
    const folder = `/home/dev/${'cartella-molto-lunga/'.repeat(8)}progetto-finale`;
    const [entry] = entries(renderList([{ ...session('long', 'idle', now, label), folder }]));
    expect(titled(entry?.html ?? '', folder)).toBe('progetto-finale');
    expect(titled(entry?.html ?? '', label)).toBe(label);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-20: each entry shows the StateBadge of its state
  it('shows the StateBadge of the session state in each entry', () => {
    const states: [SessionState, string][] = [
      ['working', 'Lavora'],
      ['needs_input', 'Richiede input'],
      ['idle', 'In attesa'],
      ['ended', 'Terminata'],
    ];
    for (const [state, name] of states) {
      for (const subject of [session('s', state, now), external('s', state, now)]) {
        const [entry] = entries(renderList([subject]));
        expect(entry?.html, `${state} ${subject.external ? 'external' : 'hosted'}`).toContain(renderToStaticMarkup(<StateBadge state={state} />));
        expect(entry?.text).toContain(name);
      }
    }
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-21: a working entry shows the progress bar under the label, the others none
  it('shows the progress bar under the label of a working entry only', () => {
    const bar = renderToStaticMarkup(<ProgressBar />);
    const [working] = entries(renderList([session('w', 'working', now)]));
    expect(working?.html).toContain(bar);
    expect(working!.html.indexOf(bar)).toBeGreaterThan(working!.html.indexOf('etichetta w'));
    for (const state of ['idle', 'needs_input', 'ended'] as SessionState[]) {
      expect(renderList([session('s', state, now)]), state).not.toContain('progress-bar');
    }
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-22: the hosted needs-input card with avatar, state, needs-input line and "Rispondi"
  it('shows a hosted needs-input session as the amber card with "Permesso per <b>tool</b> · <time>" and "Rispondi"', () => {
    const html = renderList([{ ...session('web-dashboard', 'needs_input', fiveMinutesAgo, 'rimuovi le dipendenze'), waitingTool: 'Bash' }]);
    const [item] = items(html);
    expect(item).toMatch(/^<div\b[^>]*\sclass="[^"]*\bsession-card\b/);
    const [cardEntry, reply, ...rest] = buttonsIn(item ?? '');
    expect(rest).toEqual([]);
    expect(classesOf(cardEntry?.attributes ?? '')).toEqual(expect.arrayContaining(['session-entry', 'needs-input']));
    expect(classesOf(avatarTag(cardEntry?.html ?? ''))).toContain('avatar-attn');
    expect(cardEntry?.text).toMatch(/^WD web-dashboard rimuovi le dipendenze/);
    expect(cardEntry?.html).toContain(renderToStaticMarkup(<StateBadge state="needs_input" />));
    expect(reply?.text).toBe('Rispondi');
    expect(classesOf(reply?.attributes ?? '')).toEqual(expect.arrayContaining(['btn', 'label-l']));
    const describedBy = cardEntry?.attributes.match(/\saria-describedby="([^"]*)"/)?.[1];
    expect(describedBy, 'the card button is described by the needs-input line').toBeTruthy();
    const line = new RegExp(`<(\\w+)\\b[^>]*\\sid="${describedBy}"[^>]*>([\\s\\S]*?)</\\1>`).exec(item ?? '');
    expect(line?.[2]).toMatch(/^Permesso per <b>Bash<\/b> · <time\b[^>]*>5 min fa<\/time>$/);
    expect(classesOf(line?.[0] ?? '')).toContain('body-s');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-22, batch decision "Needs-input line": with no tool the label replaces "Permesso per <tool>"
  it('puts the label in place of "Permesso per <tool>" when the tool is not known', () => {
    const [item] = items(renderList([session('web-dashboard', 'needs_input', fiveMinutesAgo, 'rimuovi le dipendenze')]));
    const describedBy = item?.match(/\saria-describedby="([^"]*)"/)?.[1];
    const line = new RegExp(`\\sid="${describedBy}"[^>]*>([\\s\\S]*?)</span>\\s*<button`).exec(item ?? '')?.[1] ?? '';
    expect(textOf(line)).toBe('rimuovi le dipendenze · 5 min fa');
    expect(item).not.toContain('Permesso per');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-25: an external needs-input entry has the tag "Esterna" and no "Rispondi"
  it('shows an external needs-input entry under "Richiedono input" with the tag "Esterna" and no "Rispondi"', () => {
    const html = renderList([external('mobile-app', 'needs_input', now, 'i test falliscono'), session('hosted', 'needs_input', earlier)]);
    const group = groupsOf(html).get('Richiedono input') ?? '';
    const outside = items(group).find((item) => item.includes('title="/home/dev/progetti/mobile-app"')) ?? '';
    expect(outside).not.toContain('session-card');
    const buttons = buttonsIn(outside);
    expect(buttons).toHaveLength(1);
    expect(classesOf(buttons[0]?.attributes ?? '')).toEqual(expect.arrayContaining(['session-entry', 'external', 'needs-input']));
    expect(buttons[0]?.text).not.toContain('Rispondi');
    const tag = /<(\w+)\b([^>]*)>\s*(<svg\b(?:(?!<\/svg>)[\s\S])*<\/svg>)\s*Esterna\s*<\/\1>/.exec(buttons[0]?.html ?? '');
    expect(tag, 'tag with an icon before "Esterna"').not.toBeNull();
    expect(classesOf(tag?.[0] ?? '')).toContain('label-m');
    expect(tag?.[3]).toContain(terminalPath);
    expect(buttons[0]!.text.indexOf('Esterna')).toBeGreaterThan(buttons[0]!.text.indexOf('mobile-app'));
    expect(classesOf(avatarTag(buttons[0]?.html ?? ''))).toContain('avatar-external');
    expect(buttons[0]?.text).toContain('i test falliscono');
  });

  // SessionList "Entry variants": an external needs-input entry with a known tool shows "Permesso per <b>tool</b>" in place of the label
  it('shows "Permesso per <b>tool</b>" in place of the label of an external needs-input entry with a known tool', () => {
    const [entry] = entries(renderList([{ ...external('mobile-app', 'needs_input', now, 'i test falliscono'), waitingTool: 'Edit' }]));
    expect(entry?.html).toContain('Permesso per <b>Edit</b>');
    expect(entry?.text).not.toContain('i test falliscono');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-24: an external entry in "In altri terminali" has the outlined terminal avatar and no "Esterna" tag
  it('shows a working or idle external entry with the class external, the terminal avatar and no "Esterna" tag', () => {
    for (const state of ['working', 'idle'] as SessionState[]) {
      const html = renderList([external('mobile-app', state, now, 'Rifattorizza')]);
      expect(headings(html).map((h) => h.text)).toEqual(['In altri terminali']);
      const [entry] = entries(html);
      expect(classesOf(entry?.attributes ?? ''), state).toContain('external');
      expect(classesOf(entry?.attributes ?? ''), state).not.toContain('needs-input');
      const avatar = /<(\w+)\b[^>]*\sclass="[^"]*\bavatar\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/.exec(entry?.html ?? '');
      expect(classesOf(avatar?.[0] ?? '')).toContain('avatar-external');
      expect(avatar?.[2]).toContain(terminalPath);
      expect(entry?.text, state).not.toContain('Esterna');
      expect(entry?.text).toContain('mobile-app');
    }
  });

  // SessionList "Entry variants": a hosted entry carries neither the class external nor the tag "Esterna"
  it('marks no hosted entry as external', () => {
    for (const state of ['working', 'needs_input', 'idle', 'ended'] as SessionState[]) {
      const html = renderList([session('hosted', state, now)]);
      expect(html, state).not.toMatch(/class="[^"]*\bexternal\b/);
      expect(textOf(html), state).not.toContain('Esterna');
    }
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-27: an ended entry has the class ended and the grey avatar
  it('gives an ended entry the class ended and the grey avatar', () => {
    const [entry] = entries(renderList([session('docs-site', 'ended', earlier)]));
    expect(classesOf(entry?.attributes ?? '')).toContain('ended');
    expect(classesOf(avatarTag(entry?.html ?? ''))).toContain('avatar-ended');
    expect(entry?.text).toContain('DS');
  });

  // plan-claude_sessions_client/REQ-18, plan-claude_sessions_client-ui_redesign-material3_mock/REQ-26: only the open session is marked current
  it('marks only the open session with aria-current="true"', () => {
    const html = renderList([session('a', 'idle', earlier), session('b', 'working', now), external('c', 'idle', now)], 'a');
    const current = buttonsIn(html).filter((b) => b.attributes.includes('aria-current="true"'));
    expect(current).toHaveLength(1);
    expect(current[0]?.html).toContain('title="/home/dev/progetti/a"');
    expect(html.match(/aria-current=/g)).toHaveLength(1);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-26, SessionList: the open needs-input card keeps the card and marks its button current
  it('keeps the amber card of an open needs-input session and marks only its entry button current', () => {
    const html = renderList([session('asking', 'needs_input', now), session('other', 'idle', earlier)], 'asking');
    const [card] = items(html);
    expect(card).toMatch(/^<div\b[^>]*\sclass="[^"]*\bsession-card\b/);
    const [cardEntry, reply] = buttonsIn(card ?? '');
    expect(classesOf(cardEntry?.attributes ?? '')).toContain('needs-input');
    expect(cardEntry?.attributes).toContain('aria-current="true"');
    expect(reply?.attributes).not.toContain('aria-current');
    expect(html.match(/aria-current=/g)).toHaveLength(1);
  });

  // plan-claude_sessions_client/REQ-22: ten sessions, ten entries
  it('shows an item for each of ten sessions', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => session(`s${i}`, i % 3 === 0 ? 'needs_input' : 'working', now));
    expect(items(renderList(sessions))).toHaveLength(10);
    expect(entries(renderList(sessions))).toHaveLength(10);
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
