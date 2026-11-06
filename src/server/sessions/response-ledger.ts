import type { ModelResponse } from './model-response.js';
import { costOf } from './response-cost.js';

export interface TokenTotals {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export interface CostTotal {
  usd?: number;
  incomplete: boolean;
}

interface LedgerRecord {
  response: ModelResponse;
  usd: number | undefined;
}

export class ResponseLedger {
  readonly #records = new Map<string, LedgerRecord>();
  readonly #totals: TokenTotals = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
  #knownUsd = 0;
  #knownCosts = 0;
  #unknownCosts = 0;

  add(response: ModelResponse): void {
    const previous = this.#records.get(response.key);
    if (previous && previous.response.output > response.output) return;
    if (previous) this.#count(previous, -1);
    const record = { response, usd: costOf(response) };
    this.#records.set(response.key, record);
    this.#count(record, 1);
  }

  totals(): TokenTotals | undefined {
    return this.#records.size === 0 ? undefined : { ...this.#totals };
  }

  cost(): CostTotal | undefined {
    if (this.#records.size === 0) return undefined;
    return { ...(this.#knownCosts > 0 && { usd: this.#knownUsd }), incomplete: this.#unknownCosts > 0 };
  }

  #count({ response, usd }: LedgerRecord, sign: 1 | -1): void {
    this.#totals.input += sign * response.input;
    this.#totals.output += sign * response.output;
    this.#totals.cacheWrite += sign * response.cacheWrite;
    this.#totals.cacheRead += sign * response.cacheRead;
    if (usd === undefined) {
      this.#unknownCosts += sign;
    } else {
      this.#knownUsd += sign * usd;
      this.#knownCosts += sign;
    }
  }
}
