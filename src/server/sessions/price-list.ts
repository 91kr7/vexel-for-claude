/** USD per million tokens. */
export interface TokenPrices {
  input: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
  cacheRead: number;
  output: number;
}

export interface PriceTier extends TokenPrices {
  /** The smallest prompt length, in tokens, the tier applies to. */
  fromPromptTokens: number;
}

/** The tiers of a model, by ascending `fromPromptTokens`; the first starts at 0. */
export type ModelPricing = readonly PriceTier[];

export const PRICES_READ_ON = '2026-11-06';

const flat = (input: number, cacheWrite5m: number, cacheWrite1h: number, cacheRead: number, output: number): ModelPricing => [
  { fromPromptTokens: 0, input, cacheWrite5m, cacheWrite1h, cacheRead, output },
];

const PRICES: ReadonlyMap<string, ModelPricing> = new Map([
  ['claude-fable-5-1', flat(10, 12.5, 20, 0.25, 50)],
  ['claude-mythos-5-1', flat(10, 12.5, 20, 0.25, 50)],
  ['claude-fable-5', flat(10, 12.5, 20, 1, 50)],
  ['claude-mythos-5', flat(10, 12.5, 20, 1, 50)],
  ['claude-opus-5-5', flat(4, 5, 8, 0.2, 20)],
  ['claude-opus-5', flat(5, 6.25, 10, 0.5, 25)],
  ['claude-opus-4-8', flat(5, 6.25, 10, 0.5, 25)],
  ['claude-opus-4-7', flat(5, 6.25, 10, 0.5, 25)],
  ['claude-opus-4-6', flat(5, 6.25, 10, 0.5, 25)],
  ['claude-opus-4-5', flat(5, 6.25, 10, 0.5, 25)],
  ['claude-opus-4-1', flat(15, 18.75, 30, 1.5, 75)],
  ['claude-opus-4', flat(15, 18.75, 30, 1.5, 75)],
  ['claude-sonnet-5-5', flat(2, 2.5, 4, 0.1, 10)],
  ['claude-sonnet-5', flat(2, 2.5, 4, 0.2, 10)],
  ['claude-sonnet-4-6', flat(3, 3.75, 6, 0.3, 15)],
  ['claude-sonnet-4-5', flat(3, 3.75, 6, 0.3, 15)],
  ['claude-sonnet-4', flat(3, 3.75, 6, 0.3, 15)],
  [
    'claude-haiku-5-5',
    [
      { fromPromptTokens: 0, input: 0.1, cacheWrite5m: 0.125, cacheWrite1h: 0.2, cacheRead: 0.01, output: 0.5 },
      { fromPromptTokens: 100_001, input: 0.5, cacheWrite5m: 0.625, cacheWrite1h: 1, cacheRead: 0.05, output: 2.5 },
    ],
  ],
  ['claude-haiku-4-5', flat(1, 1.25, 2, 0.1, 5)],
]);

const LONG_CONTEXT_MARKER = '[1m]';
const DATE_SUFFIX = /-\d{8}$/;

export function pricingOf(model: string): ModelPricing | undefined {
  const id = model.toLowerCase().replaceAll(LONG_CONTEXT_MARKER, '').trim().replace(DATE_SUFFIX, '');
  return PRICES.get(id);
}
