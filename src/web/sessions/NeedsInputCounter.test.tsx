import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SessionState, SessionSummary } from './live-session-store';
import { NeedsInputCounter, countNeedsInput } from './NeedsInputCounter';
import { StateBadge, StateDot } from './StateBadge';

const textOf = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const sessionsIn = (states: SessionState[]): SessionSummary[] =>
  states.map((state, i) => ({ id: `s${i}`, folder: `/p/s${i}`, label: `s${i}`, state, lastActivity: '2026-11-05T10:00:00.000Z' }));

const renderCounter = (states: SessionState[]) => renderToStaticMarkup(<NeedsInputCounter sessions={sessionsIn(states)} />);
/** The first element whose opening tag matches `opening`, with balanced nested tags of the same name. */
function element(html: string, opening: RegExp): { attributes: string; inner: string } | null {
  const start = html.match(opening);
  if (!start || start.index === undefined) return null;
  const [tag, name = '', attributes = ''] = start;
  if (tag.endsWith('/>')) return { attributes, inner: '' };
  const tags = new RegExp(`<(/?)${name}\\b[^>]*>`, 'g');
  tags.lastIndex = start.index + tag.length;
  for (let depth = 1, m = tags.exec(html); m; m = tags.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return { attributes, inner: html.slice(start.index + tag.length, m.index) };
  }
  return null;
}

const statusElement = (html: string) => element(html, /<(\w+)([^>]*\srole="status"[^>]*)\/?>/);
const statusInner = (html: string) => statusElement(html)?.inner ?? '';
const chipOf = (html: string) => element(html, /<(\w+)([^>]*)>/);
const classesOf = (attributes: string) => attributes.match(/\sclass="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];

describe('countNeedsInput', () => {
  // NeedsInputCounter contract: countNeedsInput gives the number of sessions in needs_input
  it.each<[SessionState[], number]>([
    [[], 0],
    [['working', 'idle', 'ended'], 0],
    [['needs_input'], 1],
    [['needs_input', 'working', 'needs_input', 'ended', 'idle'], 2],
  ])('counts the sessions in needs_input among %j', (states, expected) => {
    expect(countNeedsInput(sessionsIn(states))).toBe(expected);
  });
});

describe('NeedsInputCounter', () => {
  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-21: the chip reads "N need input" inside the status element
  it('shows the chip "N need input" inside the role="status" element when N > 0', () => {
    const html = renderCounter(['needs_input', 'working', 'needs_input', 'ended', 'idle']);
    expect(statusElement(html), html).not.toBeNull();
    const chip = chipOf(statusInner(html));
    expect(chip, html).not.toBeNull();
    expect(textOf(chip?.inner ?? '')).toBe('2 need input');
  });

  // NeedsInputCounter "Shows": the pill has the classes of the amber StateBadge chip
  it('gives the pill the classes of the needs_input StateBadge chip', () => {
    const chip = chipOf(statusInner(renderCounter(['needs_input'])));
    const badge = chipOf(renderToStaticMarkup(<StateBadge state="needs_input" variant="chip" />));
    expect(classesOf(chip?.attributes ?? '')).toEqual(expect.arrayContaining(classesOf(badge?.attributes ?? '')));
  });

  // NeedsInputCounter "Shows": the pulsing amber dot comes before the text, no icon
  it('shows the amber StateDot before the text and no icon', () => {
    const inner = (chipOf(statusInner(renderCounter(['needs_input', 'idle'])))?.inner ?? '').trim();
    const dot = renderToStaticMarkup(<StateDot state="needs_input" />);
    expect(inner.startsWith(dot), inner).toBe(true);
    expect(textOf(inner.slice(dot.length))).toBe('1 needs input');
    expect(inner).not.toMatch(/<svg\b/);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-11: hidden at zero, while the status element stays present
  it('keeps an empty role="status" element and shows no chip when N = 0', () => {
    for (const states of [[], ['working', 'idle', 'ended']] as SessionState[][]) {
      const html = renderCounter(states);
      expect(statusElement(html), html).not.toBeNull();
      expect(textOf(statusInner(html)), html).toBe('');
      expect(statusInner(html), html).toBe('');
    }
  });
});
