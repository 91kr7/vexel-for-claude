import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CircleAlertIcon } from '../icons/Icons';
import type { SessionState, SessionSummary } from './live-session-store';
import { NeedsInputCounter, countNeedsInput } from './NeedsInputCounter';

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
const chipOf = (html: string) => element(html, /<(\w+)([^>]*\sclass="[^"]*\bchip\b[^"]*"[^>]*)>/);

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
  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-11: the chip reads "N richiede input" inside the status element
  it('shows the chip "N richiede input" inside the role="status" element when N > 0', () => {
    const html = renderCounter(['needs_input', 'working', 'needs_input', 'ended', 'idle']);
    expect(statusElement(html), html).not.toBeNull();
    const chip = chipOf(statusInner(html));
    expect(chip, html).not.toBeNull();
    expect(textOf(chip?.inner ?? '')).toBe('2 richiede input');
  });

  // NeedsInputCounter "Shows": the chip carries the .chip and .label-l classes of the board
  it('gives the chip the classes "chip" and "label-l"', () => {
    const chip = chipOf(statusInner(renderCounter(['needs_input'])));
    expect(chip?.attributes).toMatch(/class="(?=[^"]*\bchip\b)(?=[^"]*\blabel-l\b)[^"]*"/);
  });

  // NeedsInputCounter "Shows": the circle-alert icon comes before the text
  it('shows the circle-alert icon before the text', () => {
    const inner = (chipOf(statusInner(renderCounter(['needs_input', 'idle'])))?.inner ?? '').trim();
    const icon = renderToStaticMarkup(<CircleAlertIcon />);
    expect(inner.startsWith(icon), inner).toBe(true);
    expect(textOf(inner.slice(icon.length))).toBe('1 richiede input');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-11: hidden at zero, while the status element stays present
  it('keeps an empty role="status" element and shows no chip when N = 0', () => {
    for (const states of [[], ['working', 'idle', 'ended']] as SessionState[][]) {
      const html = renderCounter(states);
      expect(statusElement(html), html).not.toBeNull();
      expect(textOf(statusInner(html)), html).toBe('');
      expect(html).not.toMatch(/\bchip\b/);
      expect(html).not.toMatch(/<svg\b/);
    }
  });
});
