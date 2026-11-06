import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SessionState } from './live-session-store';
import { StateBadge, StateDot } from './StateBadge';

const table: [SessionState, string][] = [
  ['working', 'Running'],
  ['needs_input', 'Needs Input'],
  ['idle', 'Idle'],
  ['ended', 'Ended'],
];

const textOf = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const ariaHiddenCount = (html: string) => (html.match(/\saria-hidden="true"/g) ?? []).length;

describe('StateBadge', () => {
  // StateBadge spec: inline is the default variant and shows the name alone, with no dot
  it.each(table)('%s inline shows the name "%s" and no dot', (state, name) => {
    const html = renderToStaticMarkup(<StateBadge state={state} />);
    expect(html).toBe(renderToStaticMarkup(<StateBadge state={state} variant="inline" />));
    expect(textOf(html)).toBe(name);
    expect(ariaHiddenCount(html)).toBe(0);
    expect(html).not.toMatch(/<svg\b/);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-31: the chip is the dot, then the name
  it.each(table)('%s as chip shows a decorative dot, then the name "%s"', (state, name) => {
    const html = renderToStaticMarkup(<StateBadge state={state} variant="chip" />);
    const dot = renderToStaticMarkup(<StateDot state={state} />);
    const inner = html.replace(/^<span\b[^>]*>/, '').replace(/<\/span>$/, '');
    expect(inner.startsWith(dot), 'the dot comes first').toBe(true);
    expect(textOf(html)).toBe(name);
    expect(html).not.toMatch(/\saria-label=/);
    expect(html).not.toMatch(/<svg\b/);
  });

  // StateBadge spec: the dot variant is the decorative dot alone
  it.each(table)('%s as dot is the decorative StateDot with no text', (state) => {
    const html = renderToStaticMarkup(<StateBadge state={state} variant="dot" />);
    expect(html).toBe(renderToStaticMarkup(<StateDot state={state} />));
    expect(html).toMatch(/^<\w+\b[^>]*\saria-hidden="true"/);
    expect(textOf(html)).toBe('');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-8: emerald, amber and zinc dots are told apart
  it('draws the working, needs-input and idle dots differently', () => {
    const dots = (['working', 'needs_input', 'idle'] as SessionState[]).map((state) => renderToStaticMarkup(<StateDot state={state} />));
    expect(new Set(dots).size).toBe(3);
  });
});
