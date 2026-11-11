import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SessionState, SessionSummary } from './live-session-store';
import { SessionList } from './SessionList';
import { SessionNameEditor } from './SessionNameEditor';

const session = (id: string, state: SessionState, extra: Partial<SessionSummary> = {}): SessionSummary => ({
  id,
  folder: `/home/dev/${id}`,
  label: `Label of ${id}`,
  state,
  lastActivity: new Date().toISOString(),
  ...extra,
});

const items = (html: string) => [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((m) => m[1] ?? '');
/** Each button of the html: its accessible name (aria-label, else its text) and whether it is the entry button. */
const buttonsOf = (html: string) =>
  [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => {
    const attributes = m[1] ?? '';
    const name = attributes.match(/\saria-label="([^"]*)"/)?.[1] ?? (m[2] ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return /\bsession-entry\b/.test(attributes.match(/\sclass="([^"]*)"/)?.[1] ?? '') ? 'entry' : name;
  });

describe('SessionList "Rename"', () => {
  // plan-session_list_improvements/REQ-25: every entry, hosted or external, in any state, has "Rename", outside the entry button
  it.each([
    ['hosted idle', session('a', 'idle')],
    ['hosted working', session('a', 'working')],
    ['hosted needs-input card', session('a', 'needs_input')],
    ['hosted ended', session('a', 'ended')],
    ['external idle', session('a', 'idle', { external: true })],
    ['external working', session('a', 'working', { external: true })],
    ['external needs input', session('a', 'needs_input', { external: true })],
  ])('shows one "Rename" button with the tooltip "Rename" on a %s entry', (_, summary) => {
    const html = renderToStaticMarkup(<SessionList sessions={[summary]} openSessionId={null} onOpen={() => {}} />);
    const [item] = items(html);
    expect(buttonsOf(item ?? '').filter((name) => name === 'Rename')).toHaveLength(1);
    expect(item).toMatch(/<button\b[^>]*\saria-label="Rename"[^>]*\stitle="Rename"|<button\b[^>]*\stitle="Rename"[^>]*\saria-label="Rename"/);
  });

  // SessionList spec: "Rename" comes after the EndedEntryActions and the favorite button in the tab order
  it('puts "Rename" after "Resume", "Dismiss" and the favorite button of an ended hosted entry', () => {
    const html = renderToStaticMarkup(<SessionList sessions={[session('a', 'ended', { resumable: true })]} openSessionId={null} onOpen={() => {}} />);
    expect(buttonsOf(items(html)[0] ?? '')).toEqual(['entry', 'Resume', 'Dismiss', 'Mark as Favorite', 'Rename']);
  });
});

describe('SessionNameEditor', () => {
  // plan-session_list_improvements/REQ-33, REQ-39: the field "Session Name" holds the label and accepts at most 200 characters
  it('is a text field named "Session Name" holding the current label, limited to 200 characters', () => {
    const html = renderToStaticMarkup(<SessionNameEditor sessionId="a" label={'Fix "the" login & form'} onEnd={() => {}} />);
    const input = /<input\b([^>]*)\/?>/.exec(html)?.[1] ?? '';
    expect(input, 'one input').not.toBe('');
    expect(input).toMatch(/\saria-label="Session Name"/);
    expect(input).toContain('value="Fix &quot;the&quot; login &amp; form"');
    expect(input).toMatch(/\smaxLength="200"|\smaxlength="200"/);
    expect(html).not.toContain('Could not rename the session.');
  });
});
