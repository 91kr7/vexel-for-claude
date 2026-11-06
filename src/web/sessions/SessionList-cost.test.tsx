import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SessionState, SessionSummary, SessionUsage } from './live-session-store';
import { SessionList } from './SessionList';

const INCOMPLETE = 'Incomplete: the price of a model is unknown';
const decode = (html: string) => html.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const textOf = (html: string) => decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
/** The text a screen reader gets: elements hidden from assistive technology removed. */
const accessibleTextOf = (html: string) => textOf(html.replace(/<span[^>]*aria-hidden="true"[^>]*>[^<]*<\/span>/g, ''));

const lastActivity = new Date().toISOString();
const session = (id: string, state: SessionState, usage?: SessionUsage, external = false): SessionSummary => ({
  id,
  folder: `/home/dev/progetti/${id}`,
  label: `label ${id}`,
  state,
  lastActivity,
  ...(external ? { external: true as const } : {}),
  ...(usage ? { usage } : {}),
});
const context = { used: 45_200, window: 200_000 };
const tokens = { input: 1, output: 2, cacheWrite: 3, cacheRead: 4 };
const priced = (usd: number | undefined, incomplete = false, withContext = true): SessionUsage => ({
  ...(withContext ? { context } : {}),
  tokens,
  cost: { ...(usd === undefined ? {} : { usd }), incomplete },
});

const renderList = (sessions: SessionSummary[]) => renderToStaticMarkup(<SessionList sessions={sessions} openSessionId={null} onOpen={() => {}} />);

/** The html of the entry of a session: from its list item to the next one. */
function entryOf(html: string, id: string): string {
  const part = html.split(/(?=<li\b)/).find((p) => p.includes(`title="/home/dev/progetti/${id}"`));
  expect(part, `entry of ${id}`).toBeDefined();
  return part!;
}

/** The innermost element whose own text is `text`, with its attributes. */
function elementWithText(html: string, text: string): { tag: string; attributes: string } | undefined {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/</g, '&lt;');
  const match = new RegExp(`<(\\w+)([^>]*)>\\s*${escaped}\\s*</\\1>`).exec(html);
  return match ? { tag: match[1]!, attributes: match[2]! } : undefined;
}
const attribute = (attributes: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(attributes)?.[1];
/** The entry text from the label to the time: the line 2 figures. */
const line2Of = (entry: string) => {
  const text = textOf(entry);
  return text.slice(text.indexOf('label '));
};

describe('SessionList, estimated cost', () => {
  // plan-session_usage/REQ-22, REQ-32: line 2 reads "23% · $1.27", after the percentage and before the time
  it('shows the cost after the percentage, before the time', () => {
    const entry = entryOf(renderList([session('h', 'working', priced(1.27))]), 'h');
    expect(line2Of(entry)).toMatch(/^label h 23% · \$1\.27 \S/);
    const timeAt = entry.search(/class="[^"]*\bsession-entry-time\b/);
    expect(entry.indexOf('$1.27')).toBeLessThan(timeAt);
    expect(entry.indexOf('23%')).toBeLessThan(entry.indexOf('$1.27'));
  });

  // session-list spec: the "·" is hidden from assistive technology
  it('hides the separator from assistive technology', () => {
    const entry = entryOf(renderList([session('h', 'idle', priced(1.27))]), 'h');
    expect(accessibleTextOf(entry)).toContain('23% $1.27');
    expect(accessibleTextOf(entry)).not.toContain('·');
  });

  // session-list spec: without the percentage, only the amount
  it('shows only the amount when there is no context', () => {
    const entry = entryOf(renderList([session('h', 'idle', priced(1.27, false, false))]), 'h');
    expect(line2Of(entry)).toMatch(/^label h \$1\.27 \S/);
    expect(textOf(entry)).not.toContain('·');
  });

  // plan-session_usage/REQ-29: the label of the estimate is the tooltip of the amount
  it('labels the amount "Estimated cost at API list prices"', () => {
    const amount = elementWithText(entryOf(renderList([session('h', 'idle', priced(1.27))]), 'h'), '$1.27');
    expect(amount).toBeDefined();
    expect(attribute(amount!.attributes, 'title')).toBe('Estimated cost at API list prices');
  });

  // plan-session_usage/REQ-32: below one cent
  it('shows "<$0.01" below one cent', () => {
    const entry = entryOf(renderList([session('h', 'idle', priced(0.004))]), 'h');
    expect(line2Of(entry)).toMatch(/^label h 23% · <\$0\.01 \S/);
  });

  // plan-session_usage/REQ-30: an incomplete cost gets the "*" mark with its tooltip and accessible name
  it('marks an incomplete cost with "*"', () => {
    const entry = entryOf(renderList([session('h', 'idle', priced(1.27, true))]), 'h');
    expect(line2Of(entry)).toMatch(/^label h 23% · \$1\.27 \* \S/);
    const mark = elementWithText(entry, '*');
    expect(mark).toBeDefined();
    expect(attribute(mark!.attributes, 'title')).toBe(INCOMPLETE);
    expect(attribute(mark!.attributes, 'aria-label')).toBe(INCOMPLETE);
    expect(attribute(mark!.attributes, 'role'), 'an accessible name needs a role that takes it').toBeDefined();
  });

  // plan-session_usage/REQ-30: a complete cost has no mark
  it('shows no mark on a complete cost', () => {
    const entry = entryOf(renderList([session('h', 'idle', priced(1.27))]), 'h');
    expect(elementWithText(entry, '*')).toBeUndefined();
    expect(entry).not.toContain(INCOMPLETE);
  });

  // plan-session_usage/REQ-30 (requirements decision): no known price at all → "—" with the mark
  it('shows "—" with the mark when no price is known', () => {
    const entry = entryOf(renderList([session('h', 'idle', priced(undefined, true))]), 'h');
    expect(line2Of(entry)).toMatch(/^label h 23% · — \* \S/);
    expect(attribute(elementWithText(entry, '*')!.attributes, 'aria-label')).toBe(INCOMPLETE);
  });

  // plan-session_usage/REQ-22, REQ-34: hosted and external entries, in every state, ended included
  it.each<[SessionState, boolean]>([
    ['working', false],
    ['idle', false],
    ['ended', false],
    ['working', true],
    ['needs_input', true],
    ['idle', true],
    ['ended', true],
  ])('shows the cost on a %s entry (external: %s)', (state, external) => {
    const entry = entryOf(renderList([session('s', state, priced(0.85), external)]), 's');
    expect(textOf(entry)).toContain('23% · $0.85');
  });

  // plan-session_usage/REQ-22: the hosted needs-input card shows the cost at the right of the label, after the percentage
  it('shows the cost on the needs-input card', () => {
    const entry = entryOf(renderList([session('n', 'needs_input', priced(1.27))]), 'n');
    expect(entry).toMatch(/class="[^"]*\bsession-card\b/);
    const text = textOf(entry);
    expect(text).toContain('label n 23% · $1.27');
  });

  // plan-session_usage/REQ-33: no usage.cost → no cost, never "$0.00"
  it.each<[string, SessionUsage | undefined]>([
    ['no usage', undefined],
    ['usage with only the context', { context }],
  ])('shows no cost with %s', (_name, usage) => {
    for (const state of ['working', 'needs_input', 'ended'] as const) {
      const entry = entryOf(renderList([session('z', state, usage)]), 'z');
      expect(textOf(entry)).not.toContain('$');
      expect(textOf(entry)).not.toMatch(/·\s*(\$|<|—)/);
      expect(entry).not.toContain('Estimated cost at API list prices');
    }
  });
});
