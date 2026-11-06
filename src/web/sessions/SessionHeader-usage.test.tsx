import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SessionUsage } from './live-session-store';
import { SessionHeader, type SessionHeaderSummary } from './SessionHeader';
import { StateBadge } from './StateBadge';

const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const actions = <button type="button">Azione</button>;
const summary = (usage?: SessionUsage): SessionHeaderSummary => ({
  folder: '/home/dev/progetti/negozio',
  label: 'Aggiungi il carrello',
  state: 'idle',
  ...(usage ? { usage } : {}),
});
const render = (usage?: SessionUsage) => renderToStaticMarkup(<SessionHeader session={summary(usage)} actions={actions} />);

/** The context chip: the `.mono-chip` element that holds "Context". */
function chipOf(html: string): string | undefined {
  return elementAt(html, html.search(/<span[^>]*class="[^"]*\bmono-chip\b[^"]*"[^>]*>\s*(<span[^>]*>)?\s*Context\b/));
}

/** The tokens chip: the `.mono-chip` element whose text starts with "<count> tokens". */
function tokensChipOf(html: string): string | undefined {
  return elementAt(html, html.search(/<span[^>]*class="[^"]*\bmono-chip\b[^"]*"[^>]*>\s*(<span[^>]*>)?\s*[\d.]+[kM]? tokens\b/));
}

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

describe('SessionHeader, context chip', () => {
  // plan-session_usage/REQ-2, REQ-11: "Context 45.2k / 200k · 23%"
  it('shows "Context 45.2k / 200k · 23%"', () => {
    const chip = chipOf(render({ context: { used: 45_200, window: 200_000 } }));
    expect(chip).toBeDefined();
    expect(text(chip!)).toBe('Context 45.2k / 200k · 23%');
  });

  // plan-session_usage/REQ-4, REQ-5, REQ-11: the 1M window in short form
  it.each([
    [300_000, 'Context 300k / 1M · 30%'],
    [150_000, 'Context 150k / 1M · 15%'],
  ])('shows %d used tokens of 1,000,000 as %s', (used, shown) => {
    expect(text(chipOf(render({ context: { used, window: 1_000_000 } }))!)).toBe(shown);
  });

  // SessionHeader spec: the context chip comes before the state pill
  it('puts the chip before the state pill', () => {
    const html = render({ context: { used: 45_200, window: 200_000 } });
    const pill = renderToStaticMarkup(<StateBadge state="idle" variant="chip" />);
    expect(html.indexOf(chipOf(html)!)).toBeLessThan(html.indexOf(pill));
  });

  // plan-session_usage/REQ-8: normal below 70 %, warning from 70 %, error from 90 %
  it.each([
    [138_000, 'usage-normal'],
    [149_000, 'usage-warning'],
    [183_000, 'usage-error'],
  ])('gives the value of %d used tokens the class %s', (used, level) => {
    const chip = chipOf(render({ context: { used, window: 200_000 } }))!;
    const value = /<span[^>]*class="([^"]*)"[^>]*>[^<]*%<\/span>/.exec(chip);
    expect(value?.[1]?.split(/\s+/)).toContain(level);
    for (const other of ['usage-normal', 'usage-warning', 'usage-error'].filter((name) => name !== level)) {
      expect(chip).not.toContain(other);
    }
  });

  // plan-session_usage/REQ-9: no usage.context → no chip, never "0%"
  it.each([
    ['no usage', undefined],
    ['usage with no context', {}],
  ])('shows no chip with %s', (_name, usage) => {
    const html = render(usage);
    expect(chipOf(html)).toBeUndefined();
    expect(text(html)).not.toContain('Context');
    expect(text(html)).not.toMatch(/\b0%/);
  });
});

describe('SessionHeader, tokens chip', () => {
  const tokens = (input: number, output: number, cacheWrite: number, cacheRead: number) => ({ input, output, cacheWrite, cacheRead });

  // plan-session_usage/REQ-13, REQ-11: the total of the four parts, in short form, followed by "tokens"
  it.each([
    [tokens(12_000, 38_000, 250_000, 1_000_000), '1.3M tokens'],
    [tokens(200, 15_000, 10_000, 20_000), '45.2k tokens'],
    [tokens(100, 200, 300, 350), '950 tokens'],
  ])('shows %o as "%s"', (totals, shown) => {
    const chip = tokensChipOf(render({ tokens: totals }));
    expect(chip).toBeDefined();
    expect(text(chip!).startsWith(shown)).toBe(true);
  });

  // SessionHeader spec: the tokens chip is focusable with the keyboard
  it('makes the chip focusable', () => {
    const chip = tokensChipOf(render({ tokens: tokens(1, 2, 3, 4) }))!;
    expect(chip.slice(0, chip.indexOf('>'))).toMatch(/\stabindex="0"/);
  });

  // SessionHeader spec: context chip, then tokens chip, then the state pill
  it('puts the tokens chip after the context chip and before the state pill', () => {
    const html = render({ context: { used: 45_200, window: 200_000 }, tokens: tokens(1, 2, 3, 4) });
    const pill = renderToStaticMarkup(<StateBadge state="idle" variant="chip" />);
    const context = html.indexOf(chipOf(html)!);
    const chip = html.indexOf(tokensChipOf(html)!);
    expect(context).toBeLessThan(chip);
    expect(chip).toBeLessThan(html.indexOf(pill));
  });

  // plan-session_usage/REQ-18: no usage.tokens → no chip, never "0 tokens"
  it.each([
    ['no usage', undefined],
    ['usage with no tokens', {}],
    ['usage with only the context', { context: { used: 45_200, window: 200_000 } }],
  ])('shows no tokens chip with %s', (_name, usage) => {
    const html = render(usage);
    expect(tokensChipOf(html)).toBeUndefined();
    expect(text(html)).not.toMatch(/\btokens\b/);
  });
});
