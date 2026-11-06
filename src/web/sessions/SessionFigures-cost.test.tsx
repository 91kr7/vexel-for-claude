import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SessionUsage } from './live-session-store';
import { SessionFigures } from './SessionFigures';

const INCOMPLETE = 'Incomplete: the price of a model is unknown';
const COST_TOOLTIP = 'Estimated cost at API list prices';
const decode = (html: string) => html.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const text = (html: string) => decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const render = (usage?: SessionUsage) => renderToStaticMarkup(<SessionFigures usage={usage} />);

const tokens = { input: 1_000, output: 2_000, cacheWrite: 3_000, cacheRead: 4_000 };
const priced = (usd: number | undefined, incomplete = false): SessionUsage => ({ tokens, cost: { ...(usd === undefined ? {} : { usd }), incomplete } });

/** The whole `span` element that starts at `start`. */
function elementAt(html: string, start: number): string | undefined {
  if (start < 0) return undefined;
  let depth = 0;
  const pattern = /<(\/?)span\b[^>]*>/g;
  pattern.lastIndex = start;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, match.index + match[0].length);
  }
  return undefined;
}
const chipsOf = (html: string) =>
  [...html.matchAll(/<span[^>]*class="[^"]*\bmono-chip\b[^"]*"[^>]*>/g)].map((match) => elementAt(html, match.index)).filter((chip) => chip !== undefined);
const attribute = (attributes: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(attributes)?.[1];
/** The cost chip: the `.mono-chip` element that holds the cost label as a tooltip. */
const costChipOf = (html: string) => chipsOf(html).find((chip) => chip.includes(`title="${COST_TOOLTIP}"`));
/** The text of the element that carries the cost label as its tooltip. */
const labelledAmountOf = (chip: string) => text(new RegExp(`<span[^>]*title="${COST_TOOLTIP}"[^>]*>([^<]*)</span>`).exec(chip)?.[1] ?? '');
const tokensChipOf = (html: string) => chipsOf(html).find((chip) => /^[\d.]+[kM]? tokens\b/.test(text(chip)));

describe('SessionFigures, cost chip', () => {
  // plan-session_usage/REQ-23, REQ-32, plan-session_list_width/REQ-20 (assumption "Cost label"): the amount, the label as tooltip
  it.each([
    [1.27, '$1.27'],
    [0.85, '$0.85'],
    [12, '$12.00'],
    [0.004, '<$0.01'],
  ])('shows %d as "%s" with the tooltip "Estimated cost at API list prices"', (usd, shown) => {
    const chip = costChipOf(render(priced(usd)));
    expect(chip).toBeDefined();
    expect(text(chip!)).toBe(shown);
    expect(labelledAmountOf(chip!)).toBe(shown);
  });

  // plan-session_list_width, assumption "Cost label": the label is a tooltip, not text
  it('does not show the cost label as text', () => {
    expect(text(render(priced(1.27)))).not.toMatch(/estimate/i);
  });

  // SessionFigures "Shows": context, tokens, then cost
  it('puts the cost chip after the tokens chip', () => {
    const html = render(priced(1.27));
    const tokensAt = html.indexOf(tokensChipOf(html)!);
    expect(tokensAt).toBeGreaterThanOrEqual(0);
    expect(tokensAt).toBeLessThan(html.indexOf(costChipOf(html)!));
  });

  // plan-session_usage/REQ-30: the word "incomplete" after the amount, with its tooltip and accessible name
  it('adds "incomplete" to an incomplete cost', () => {
    const chip = costChipOf(render(priced(1.27, true)))!;
    expect(text(chip)).toBe('$1.27 incomplete');
    const word = /<span([^>]*)>\s*incomplete\s*<\/span>/.exec(chip);
    expect(word).not.toBeNull();
    expect(attribute(word![1]!, 'title')).toBe(INCOMPLETE);
    expect(attribute(word![1]!, 'aria-label')).toBe(INCOMPLETE);
  });

  // plan-session_usage/REQ-30: no known price at all → "—" with the mark
  it('shows "—" with "incomplete" when no price is known', () => {
    expect(text(costChipOf(render(priced(undefined, true)))!)).toBe('— incomplete');
  });

  // plan-session_usage/REQ-30: a complete cost has no mark
  it('shows no mark on a complete cost', () => {
    const html = render(priced(1.27));
    expect(text(costChipOf(html)!)).not.toContain('incomplete');
    expect(html).not.toContain(INCOMPLETE);
  });

  // plan-session_usage/REQ-33, plan-session_list_width/REQ-26: no usage.cost → no chip, never "$0.00"
  it.each<[string, SessionUsage | undefined]>([
    ['no usage', undefined],
    ['usage with no cost', {}],
    ['usage with the context only', { context: { used: 45_200, window: 200_000 } }],
  ])('shows no cost chip with %s', (_name, usage) => {
    const html = render(usage);
    expect(costChipOf(html)).toBeUndefined();
    expect(text(html)).not.toContain('$');
  });
});
