import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AreaState } from '../feedback/AreaState';
import { CircleXIcon, LoaderCircleIcon } from '../icons/Icons';
import type { LoadStatus, SessionState, SessionSummary } from './live-session-store';
import { ProgressBar } from './ProgressBar';
import { SessionList } from './SessionList';
import { StateBadge, StateDot } from './StateBadge';

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

const hasAvatar = (html: string) => /class="[^"]*\bavatar\b/.test(html);
const titled = (html: string, value: string) => new RegExp(`<\\w+\\b[^>]*\\stitle="${value}"[^>]*>\\s*([^<]*?)\\s*<`).exec(html)?.[1];
const dotOf = (state: SessionState) => renderToStaticMarkup(<StateDot state={state} />);

describe('SessionList', () => {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60_000);
  const earlier = new Date(now.getTime() - 20 * 60_000);

  // plan-claude_sessions_client/REQ-11: empty list
  it('shows "No sessions." and no entry when there is no session', () => {
    const html = renderList([]);
    expect(textOf(html)).toContain('No sessions.');
    expect(buttonsIn(html)).toEqual([]);
    expect(headings(html)).toEqual([]);
  });

  // SessionList "Description": not a landmark, the list panel of AppLayout carries the label "Session List"
  it('is not a landmark and carries no "Session List" label', () => {
    for (const html of [renderList([]), renderList([session('a', 'idle', now)])]) {
      expect(html).not.toMatch(/^<(?:nav|section|aside|main)\b/);
      expect(html).not.toMatch(/^<\w+[^>]*\srole="(?:navigation|region|complementary)"/);
      expect(html).not.toContain('Session List');
    }
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-16, plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-12: the four groups in order, as level-2 .section-label headings
  it('shows the four group headings in order, as level-2 .section-label headings', () => {
    const html = renderList([
      session('ended', 'ended', now),
      external('outside', 'working', now),
      session('hosted', 'idle', now),
      session('asking', 'needs_input', now),
    ]);
    expect(headings(html).map((h) => h.text)).toEqual(['Needs Input', 'Running', 'In Other Terminals', 'Ended']);
    for (const heading of headings(html)) expect(heading.classes, heading.text).toContain('section-label');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-16: an empty group is hidden
  it('hides the heading of an empty group', () => {
    expect(headings(renderList([session('a', 'working', now)])).map((h) => h.text)).toEqual(['Running']);
    expect(headings(renderList([external('x', 'idle', now), session('z', 'ended', now)])).map((h) => h.text)).toEqual(['In Other Terminals', 'Ended']);
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
    expect(namesIn('Needs Input')).toEqual(['e-asking', 'h-asking']);
    expect(namesIn('Running')).toEqual(['h-working', 'h-idle']);
    expect(namesIn('In Other Terminals')).toEqual(['e-idle', 'e-working']);
    expect(namesIn('Ended')).toEqual(['h-ended', 'e-ended']);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-1: the order prop decides the place inside each group
  it('lists each group in the given order, not by latest activity', () => {
    const sessions = [session('a', 'idle', earlier), session('b', 'working', now), session('c', 'idle', fiveMinutesAgo), session('d', 'idle', now)];
    const html = renderToStaticMarkup(<SessionList sessions={sessions} openSessionId={null} onOpen={() => {}} order={{ running: ['a', 'c', 'b'] }} />);
    const names = items(groupsOf(html).get('Running') ?? '').map((item) => titled(item, '/home/dev/progetti/[\\w-]+') ?? '?');
    expect(names).toEqual(['a', 'c', 'b', 'd']);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-23, REQ-25: dot, folder name, state, then label and time; no avatar
  it('shows the status dot first, then the folder name, the state, the label and the relative time, in this order, with no avatar', () => {
    const [entry] = entries(renderList([{ ...session('web-dashboard', 'idle', fiveMinutesAgo, 'Correggi il login') }]));
    expect(hasAvatar(entry?.html ?? '')).toBe(false);
    expect(entry?.html.indexOf(dotOf('idle'))).toBeGreaterThanOrEqual(0);
    expect(entry?.html.indexOf(dotOf('idle'))).toBeLessThan(entry?.html.indexOf('web-dashboard') ?? -1);
    const parts = ['web-dashboard', 'Idle', 'Correggi il login', '5m ago'];
    expect(entry?.text).toBe(parts.join(' '));
    expect(entry?.html).toMatch(new RegExp(`<time\\b[^>]*\\sdateTime="${fiveMinutesAgo.toISOString()}"[^>]*>5m ago</time>`, 'i'));
  });

  // SessionList "Entry row": folder name and label carry their full value as tooltip
  it('gives the folder name the full path and the label the full label as tooltip', () => {
    const label = `Riscrivi il modulo di autenticazione ${'e aggiorna la documentazione '.repeat(5)}`.trim();
    const folder = `/home/dev/${'cartella-molto-lunga/'.repeat(8)}progetto-finale`;
    const [entry] = entries(renderList([{ ...session('long', 'idle', now, label), folder }]));
    expect(titled(entry?.html ?? '', folder)).toBe('progetto-finale');
    expect(titled(entry?.html ?? '', label)).toBe(label);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-8, REQ-23: each entry row shows the dot and the inline name of its state
  it('shows the StateDot and the inline StateBadge of the session state in each entry row', () => {
    const states: [SessionState, string][] = [
      ['working', 'Running'],
      ['needs_input', 'Needs Input'],
      ['idle', 'Idle'],
      ['ended', 'Ended'],
    ];
    for (const [state, name] of states) {
      const subjects = state === 'needs_input' ? [external('s', state, now)] : [session('s', state, now), external('s', state, now)];
      for (const subject of subjects) {
        const [entry] = entries(renderList([subject]));
        const where = `${state} ${subject.external ? 'external' : 'hosted'}`;
        expect(entry?.html, where).toContain(dotOf(state));
        expect(entry?.html, where).toContain(renderToStaticMarkup(<StateBadge state={state} variant="inline" />));
        expect(entry?.text, where).toContain(name);
      }
    }
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-21, SessionList spec: a hosted working entry shows the progress bar under the label, the others none
  it('shows the progress bar under the label of a hosted working entry only', () => {
    const bar = renderToStaticMarkup(<ProgressBar />);
    const [working] = entries(renderList([session('w', 'working', now)]));
    expect(working?.html).toContain(bar);
    expect(working!.html.indexOf(bar)).toBeGreaterThan(working!.html.indexOf('etichetta w'));
    for (const state of ['idle', 'needs_input', 'ended'] as SessionState[]) {
      expect(renderList([session('s', state, now)]), state).not.toContain('progress-bar');
    }
  });

  // SessionList spec, gatekeeper decision on the boards: an external entry never shows the progress bar
  it('shows no progress bar on an external entry, working or not', () => {
    for (const state of ['working', 'idle', 'needs_input'] as SessionState[]) {
      expect(renderList([external('mobile-app', state, now)]), state).not.toContain('progress-bar');
    }
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-28: the hosted needs-input card with the tag, the needs-input line and the accent "Reply"
  it('shows a hosted needs-input session as the card with the tag "Needs Input", "Permission for <b>tool</b> · <time>" and "Reply"', () => {
    const html = renderList([{ ...session('web-dashboard', 'needs_input', fiveMinutesAgo, 'rimuovi le dipendenze'), waitingTool: 'Bash' }]);
    const [item] = items(html);
    expect(item).toMatch(/^<div\b[^>]*\sclass="[^"]*\bsession-card\b/);
    const [cardEntry, reply, ...rest] = buttonsIn(item ?? '');
    expect(rest).toEqual([]);
    expect(classesOf(cardEntry?.attributes ?? '')).toEqual(expect.arrayContaining(['session-entry', 'needs-input']));
    expect(hasAvatar(cardEntry?.html ?? '')).toBe(false);
    expect(cardEntry?.text).toBe('Needs Input web-dashboard rimuovi le dipendenze');
    expect(reply?.text).toBe('Reply');
    expect(classesOf(reply?.attributes ?? '')).toContain('button-primary');
    const describedBy = cardEntry?.attributes.match(/\saria-describedby="([^"]*)"/)?.[1];
    expect(describedBy, 'the card button is described by the needs-input line').toBeTruthy();
    const line = new RegExp(`<(\\w+)\\b[^>]*\\sid="${describedBy}"[^>]*>([\\s\\S]*?)</\\1>`).exec(item ?? '');
    expect(line?.[2]).toMatch(/^Permission for <b>Bash<\/b> · <time\b[^>]*>5m ago<\/time>$/);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-22, batch decision "Needs-input line": with no tool the label replaces "Permission for <tool>"
  it('puts the label in place of "Permission for <tool>" when the tool is not known', () => {
    const [item] = items(renderList([session('web-dashboard', 'needs_input', fiveMinutesAgo, 'rimuovi le dipendenze')]));
    const describedBy = item?.match(/\saria-describedby="([^"]*)"/)?.[1];
    const line = new RegExp(`<(\\w+)\\b[^>]*\\sid="${describedBy}"[^>]*>([\\s\\S]*?)</\\1>`).exec(item ?? '')?.[2] ?? '';
    expect(textOf(line)).toBe('rimuovi le dipendenze · 5m ago');
    expect(item).not.toContain('Permission for');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-27, REQ-28: an external needs-input entry is a row with the amber dot, the "External" chip and no "Reply"
  it('shows an external needs-input entry under "Needs Input" as a row with the amber dot, the chip "External" and no "Reply"', () => {
    const html = renderList([external('mobile-app', 'needs_input', now, 'i test falliscono'), session('hosted', 'needs_input', earlier)]);
    const group = groupsOf(html).get('Needs Input') ?? '';
    const outside = items(group).find((item) => item.includes('title="/home/dev/progetti/mobile-app"')) ?? '';
    expect(outside).not.toContain('session-card');
    const buttons = buttonsIn(outside);
    expect(buttons).toHaveLength(1);
    expect(classesOf(buttons[0]?.attributes ?? '')).toEqual(expect.arrayContaining(['session-entry', 'external', 'needs-input']));
    expect(buttons[0]?.text).not.toContain('Reply');
    expect(buttons[0]?.html).toContain(dotOf('needs_input'));
    const chip = /<(\w+)\b([^>]*)>\s*External\s*<\/\1>/.exec(buttons[0]?.html ?? '');
    expect(chip, 'chip "External"').not.toBeNull();
    expect(classesOf(chip?.[0] ?? '')).toContain('mono-chip');
    expect(buttons[0]!.text.indexOf('External')).toBeGreaterThan(buttons[0]!.text.indexOf('mobile-app'));
    expect(hasAvatar(buttons[0]?.html ?? '')).toBe(false);
    expect(buttons[0]?.text).toContain('i test falliscono');
  });

  // SessionList "Entry variants": an external needs-input entry with a known tool shows "Permission for <b>tool</b>" in place of the label
  it('shows "Permission for <b>tool</b>" in place of the label of an external needs-input entry with a known tool', () => {
    const [entry] = entries(renderList([{ ...external('mobile-app', 'needs_input', now, 'i test falliscono'), waitingTool: 'Edit' }]));
    expect(entry?.html).toContain('Permission for <b>Edit</b>');
    expect(entry?.text).not.toContain('i test falliscono');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-27: a working or idle external entry has the class external, its dot and no "External" chip
  it('shows a working or idle external entry with the class external, its status dot and no "External" chip', () => {
    for (const state of ['working', 'idle'] as SessionState[]) {
      const html = renderList([external('mobile-app', state, now, 'Rifattorizza')]);
      expect(headings(html).map((h) => h.text)).toEqual(['In Other Terminals']);
      const [entry] = entries(html);
      expect(classesOf(entry?.attributes ?? ''), state).toContain('external');
      expect(classesOf(entry?.attributes ?? ''), state).not.toContain('needs-input');
      expect(entry?.html, state).toContain(dotOf(state));
      expect(hasAvatar(entry?.html ?? ''), state).toBe(false);
      expect(entry?.text, state).not.toContain('External');
      expect(entry?.text).toContain('mobile-app');
    }
  });

  // SessionList "Entry variants": a hosted entry carries neither the class external nor the tag "External"
  it('marks no hosted entry as external', () => {
    for (const state of ['working', 'needs_input', 'idle', 'ended'] as SessionState[]) {
      const html = renderList([session('hosted', state, now)]);
      expect(html, state).not.toMatch(/class="[^"]*\bexternal\b/);
      expect(textOf(html), state).not.toContain('External');
    }
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-29: an ended entry has the class ended and the zinc dot
  it('gives an ended entry the class ended and the ended dot, with no avatar', () => {
    const [entry] = entries(renderList([session('docs-site', 'ended', earlier)]));
    expect(classesOf(entry?.attributes ?? '')).toContain('ended');
    expect(entry?.html).toContain(dotOf('ended'));
    expect(hasAvatar(entry?.html ?? '')).toBe(false);
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
    const LOST = 'Connection to the server lost. Reload the page.';
    const renderWith = (sessions: SessionSummary[], status: LoadStatus) =>
      renderToStaticMarkup(<SessionList sessions={sessions} openSessionId={null} onOpen={() => {}} status={status} />);
    const roleText = (html: string, role: string) =>
      [...html.matchAll(new RegExp(`<([a-z]+)\\b[^>]*\\srole="${role}"[^>]*>([\\s\\S]*?)</\\1>`, 'g'))].map((m) => textOf(m[2] ?? ''));

    // plan-claude_sessions_client-ui_redesign/REQ-29, SessionList: a loading indicator in place of "No sessions."
    it('while loading shows the status "Loading…" and not "No sessions."', () => {
      const html = renderWith([], 'loading');
      expect(roleText(html, 'status')).toEqual(['Loading…']);
      expect(textOf(html)).not.toContain('No sessions.');
      expect(html).toContain(renderToStaticMarkup(<LoaderCircleIcon />));
    });

    // plan-claude_sessions_client-ui_redesign/REQ-29, SessionList: the indicator takes the place of the entries
    it('while loading shows the indicator and no entry, even with sessions', () => {
      const html = renderWith([session('a', 'idle', now)], 'loading');
      expect(roleText(html, 'status')).toEqual(['Loading…']);
      expect(entries(html)).toEqual([]);
    });

    // plan-claude_sessions_client-ui_redesign/REQ-30, SessionList: lost connection with no session shows only the error
    it('on error with no session shows only the alert "Connection to the server lost. Reload the page."', () => {
      const html = renderWith([], 'error');
      expect(roleText(html, 'alert')).toEqual([LOST]);
      expect(html).toContain(renderToStaticMarkup(<CircleXIcon />));
      expect(textOf(html)).not.toContain('No sessions.');
      expect(html).not.toContain('role="status"');
    });

    // plan-claude_sessions_client-ui_redesign/REQ-30, SessionList: the error shows above the entries already received
    it('on error keeps the entries received, below the alert', () => {
      const html = renderWith([session('a', 'idle', now), session('b', 'working', earlier)], 'error');
      expect(entries(html)).toHaveLength(2);
      expect(html.indexOf('role="alert"')).toBeGreaterThan(-1);
      expect(html.indexOf('role="alert"')).toBeLessThan(html.indexOf('<button'));
    });

    // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-50: the three list states are compact AreaState blocks
    it('draws loading, empty and error as compact AreaState blocks', () => {
      expect(renderWith([], 'loading')).toContain(renderToStaticMarkup(<AreaState kind="loading" size="compact" title="Loading…" />));
      expect(renderWith([], 'ready')).toContain(renderToStaticMarkup(<AreaState kind="empty" size="compact" title="No sessions." />));
      expect(renderWith([], 'error')).toContain(renderToStaticMarkup(<AreaState kind="error" size="compact" title={LOST} />));
    });

    // SessionList: status defaults to ready
    it('with no status behaves as ready', () => {
      expect(renderList([])).toBe(renderWith([], 'ready'));
      expect(renderWith([], 'ready')).not.toMatch(/role="(status|alert)"/);
    });
  });
});

describe('SessionList, ended hosted entry actions', () => {
  const now = new Date();
  const actionNames = (itemHtml: string) => [...itemHtml.matchAll(/<button\b[^>]*\saria-label="(Resume|Dismiss)"/g)].map((m) => m[1]);
  const itemOf = (html: string, id: string) => items(html).find((item) => item.includes(`title="${folderOf(id)}"`)) ?? '';

  // plan-session_list_improvements/REQ-1, REQ-2: an ended hosted entry offers "Dismiss", and "Resume" only when resumable
  it('offers "Resume" and "Dismiss" on a resumable ended hosted entry, and only "Dismiss" on one with no conversation', () => {
    const html = renderList([{ ...session('saved', 'ended', now), resumable: true }, session('empty', 'ended', now)]);
    expect(actionNames(itemOf(html, 'saved'))).toEqual(['Resume', 'Dismiss']);
    expect(actionNames(itemOf(html, 'empty'))).toEqual(['Dismiss']);
  });

  // plan-session_list_improvements/REQ-3: no other entry offers "Dismiss" or "Resume"
  it('offers neither action on working, needs-input, idle or external entries, ended external ones included', () => {
    const html = renderList([
      { ...session('work', 'working', now), resumable: true },
      { ...session('wait', 'needs_input', now), resumable: true },
      { ...session('rest', 'idle', now), resumable: true },
      external('ext-work', 'working', now),
      external('ext-wait', 'needs_input', now),
      { ...external('ext-ended', 'ended', now), resumable: true },
    ]);
    expect(items(html)).toHaveLength(6);
    expect(actionNames(html)).toEqual([]);
  });

  // EndedEntryActions: the buttons sit beside the entry button, not inside it
  it('puts the actions outside the entry button of the ended entry', () => {
    const item = itemOf(renderList([{ ...session('saved', 'ended', now), resumable: true }]), 'saved');
    const entryButton = /<button\b[^>]*class="[^"]*\bsession-entry\b[^"]*"[^>]*>([\s\S]*?)<\/button>/.exec(item)?.[1] ?? '';
    expect(entryButton).toContain(`title="${folderOf('saved')}"`);
    expect(entryButton).not.toContain('<button');
    expect(entryButton).not.toMatch(/aria-label="(Resume|Dismiss)"/);
    expect(actionNames(item)).toEqual(['Resume', 'Dismiss']);
  });
});
