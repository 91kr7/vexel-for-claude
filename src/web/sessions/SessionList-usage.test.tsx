import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SessionState, SessionSummary, SessionUsage } from './live-session-store';
import { SessionList } from './SessionList';

const textOf = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

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
const used = (used: number, window = 200_000): SessionUsage => ({ context: { used, window } });

const renderList = (sessions: SessionSummary[]) => renderToStaticMarkup(<SessionList sessions={sessions} openSessionId={null} onOpen={() => {}} />);

/** The html of the entry of a session: from its list item to the next one. */
function entryOf(html: string, id: string): string {
  const part = html.split(/(?=<li\b)/).find((p) => p.includes(`title="/home/dev/progetti/${id}"`));
  expect(part, `entry of ${id}`).toBeDefined();
  return part!;
}

const percentOf = (entry: string) => /<span[^>]*class="([^"]*\bsession-entry-context\b[^"]*)"[^>]*>([^<]*)<\/span>/.exec(entry);

describe('SessionList, context percentage', () => {
  // plan-session_usage/REQ-1, REQ-11: line 2 shows the rounded percentage, before the time
  it('shows the percentage on line 2 before the time', () => {
    const entry = entryOf(renderList([session('h', 'working', used(45_200))]), 'h');
    const percent = percentOf(entry);
    expect(percent?.[2]).toBe('23%');
    const timeAt = entry.search(/class="[^"]*\bsession-entry-time\b/);
    expect(timeAt).toBeGreaterThan(0);
    expect(entry.indexOf(percent![0])).toBeLessThan(timeAt);
    expect(entry.indexOf('label h')).toBeLessThan(entry.indexOf(percent![0]));
  });

  // plan-session_usage/REQ-1, REQ-10: hosted and external entries, in every state, ended included
  it.each<[SessionState, boolean]>([
    ['working', false],
    ['idle', false],
    ['ended', false],
    ['working', true],
    ['needs_input', true],
    ['ended', true],
  ])('shows the percentage on a %s entry (external: %s)', (state, external) => {
    const html = renderList([session('s', state, used(80_000), external)]);
    expect(percentOf(entryOf(html, 's'))?.[2]).toBe('40%');
  });

  // plan-session_usage/REQ-1: the hosted needs-input card shows the percentage in the label row
  it('shows the percentage at the right of the label on the needs-input card', () => {
    const entry = entryOf(renderList([session('n', 'needs_input', used(80_000))]), 'n');
    expect(entry).toMatch(/class="[^"]*\bsession-card\b/);
    const rows = [...entry.matchAll(/<span[^>]*class="[^"]*\bsession-entry-line\b[^"]*"[^>]*>(.*?)<\/span><\/span>/g)].map((match) => match[1]!);
    const row = rows.find((html) => html.includes('session-entry-label')) ?? '';
    expect(textOf(row)).toBe('label n 40%');
    expect(row.indexOf('label n')).toBeLessThan(row.indexOf('40%'));
  });

  // plan-session_usage/REQ-8: normal below 70 %, warning from 70 %, error from 90 %
  it.each([
    [138_000, '69%', 'usage-normal'],
    [149_000, '75%', 'usage-warning'],
    [183_000, '92%', 'usage-error'],
  ])('gives %d used tokens the text %s and the class %s', (tokens, text, level) => {
    const percent = percentOf(entryOf(renderList([session('l', 'idle', used(tokens))]), 'l'));
    expect(percent?.[2]).toBe(text);
    expect(percent?.[1]?.split(/\s+/)).toContain(level);
    for (const other of ['usage-normal', 'usage-warning', 'usage-error'].filter((name) => name !== level)) {
      expect(percent?.[1]?.split(/\s+/)).not.toContain(other);
    }
  });

  // plan-session_usage/REQ-9: no usage.context → no percentage, never "0%"
  it.each([
    ['no usage', undefined],
    ['usage with no context', {}],
  ])('shows no percentage with %s', (_name, usage) => {
    for (const state of ['working', 'needs_input', 'ended'] as const) {
      const entry = entryOf(renderList([session('z', state, usage)]), 'z');
      expect(percentOf(entry)).toBeNull();
      expect(textOf(entry)).not.toMatch(/\b0%/);
    }
  });
});
