import type { ModelResponse } from './model-response.js';
import { type PriceTier, pricingOf } from './price-list.js';

const TOKENS_PER_PRICE_UNIT = 1_000_000;

export type PricedResponse = Pick<ModelResponse, 'model' | 'input' | 'output' | 'cacheWrite' | 'cacheWrite5m' | 'cacheWrite1h' | 'cacheRead'>;

/** The cost of one response in USD, or `undefined` when its model has no known price. */
export function costOf(response: PricedResponse): number | undefined {
  const pricing = pricingOf(response.model);
  if (!pricing) return undefined;
  const promptTokens = response.input + response.cacheWrite + response.cacheRead;
  let tier: PriceTier | undefined;
  for (const candidate of pricing) if (candidate.fromPromptTokens <= promptTokens) tier = candidate;
  if (!tier) return undefined;
  const split = response.cacheWrite5m !== undefined && response.cacheWrite1h !== undefined;
  const cacheWrite5m = split ? response.cacheWrite5m! : response.cacheWrite;
  const cacheWrite1h = split ? response.cacheWrite1h! : 0;
  const usd =
    response.input * tier.input +
    cacheWrite5m * tier.cacheWrite5m +
    cacheWrite1h * tier.cacheWrite1h +
    response.cacheRead * tier.cacheRead +
    response.output * tier.output;
  return usd / TOKENS_PER_PRICE_UNIT;
}
