import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SessionUsage } from './live-session-store';
import { SessionHeader, type SessionHeaderSummary } from './SessionHeader';
import { StateBadge } from './StateBadge';

const INCOMPLETE = 'Incomplete: the price of a model is unknown';
const decode = (html: string) => html.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const text = (html: string) => decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const summary = (usage?: SessionUsage): SessionHeaderSummary => ({
  folder: '/home/dev/progetti/negozio',
  label: 'Aggiungi il carrello',
  state: 'idle',
  ...(usage ? { usage } : {}),
});
const render = (usage?: SessionUsage) => renderToStaticMarkup(<SessionHeader session={summary(usage)} actions={<button type="button">Azione</button>} />);

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
/** The cost chip: the `.mono-chip` element that holds "estimate at API list prices". */
function costChipOf(html: string): string | undefined {
  const chips = [...html.matchAll(/<span[^>]*class="[^"]*\bmono-chip\b[^"]*"[^>]*>/g)].map((match) => elementAt(html, match.index));
  return chips.find((chip) => chip?.includes('estimate at API list prices'));
}
/** The tokens chip: the `.mono-chip` element whose text starts with "<count> tokens". */
const tokensChipOf = (html: string) => elementAt(html, html.search(/<span[^>]*class="[^"]*\bmono-chip\b[^"]*"[^>]*>\s*(<span[^>]*>)?\s*[\d.]+[kM]? tokens\b/));
const attribute = (attributes: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(attributes)?.[1];

describe('SessionHeader, cost chip', () => {
  // plan-session_usage/REQ-23, REQ-29, REQ-32: "$1.27 · estimate at API list prices"
  it.each([
    [1.27, '$1.27 · estimate at API list prices'],
    [0.85, '$0.85 · estimate at API list prices'],
    [12, '$12.00 · estimate at API list prices'],
    [0.004, '<$0.01 · estimate at API list prices'],
  ])('shows %d as "%s"', (usd, shown) => {
    const chip = costChipOf(render(priced(usd)));
    expect(chip).toBeDefined();
    expect(text(chip!)).toBe(shown);
  });

  // SessionHeader spec: tokens chip, then cost chip, then the state pill
  it('puts the cost chip after the tokens chip and before the state pill', () => {
    const html = render(priced(1.27));
    const pill = renderToStaticMarkup(<StateBadge state="idle" variant="chip" />);
    const tokensAt = html.indexOf(tokensChipOf(html)!);
    const costAt = html.indexOf(costChipOf(html)!);
    expect(tokensAt).toBeGreaterThanOrEqual(0);
    expect(tokensAt).toBeLessThan(costAt);
    expect(costAt).toBeLessThan(html.indexOf(pill));
  });

  // plan-session_usage/REQ-30: the amber word "incomplete" after the amount, with its tooltip and accessible name
  it('adds "incomplete" to an incomplete cost', () => {
    const chip = costChipOf(render(priced(1.27, true)))!;
    expect(text(chip)).toBe('$1.27 incomplete · estimate at API list prices');
    const word = /<span([^>]*)>\s*incomplete\s*<\/span>/.exec(chip);
    expect(word).not.toBeNull();
    expect(attribute(word![1]!, 'title')).toBe(INCOMPLETE);
    expect(attribute(word![1]!, 'aria-label')).toBe(INCOMPLETE);
  });

  // plan-session_usage/REQ-30 (requirements decision): no known price at all → "—" with the mark
  it('shows "—" with "incomplete" when no price is known', () => {
    expect(text(costChipOf(render(priced(undefined, true)))!)).toBe('— incomplete · estimate at API list prices');
  });

  // plan-session_usage/REQ-30: a complete cost has no mark
  it('shows no mark on a complete cost', () => {
    const html = render(priced(1.27));
    expect(text(costChipOf(html)!)).not.toContain('incomplete');
    expect(html).not.toContain(INCOMPLETE);
  });

  // plan-session_usage/REQ-33: no usage.cost → no chip, never "$0.00"
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
