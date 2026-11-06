import type { ModelResponse } from './model-response.js';

export interface TokenTotals {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export class ResponseLedger {
  readonly #responses = new Map<string, ModelResponse>();
  readonly #totals: TokenTotals = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };

  add(response: ModelResponse): void {
    const previous = this.#responses.get(response.key);
    if (previous && previous.output > response.output) return;
    if (previous) this.#count(previous, -1);
    this.#responses.set(response.key, response);
    this.#count(response, 1);
  }

  totals(): TokenTotals | undefined {
    return this.#responses.size === 0 ? undefined : { ...this.#totals };
  }

  #count(response: ModelResponse, sign: 1 | -1): void {
    this.#totals.input += sign * response.input;
    this.#totals.output += sign * response.output;
    this.#totals.cacheWrite += sign * response.cacheWrite;
    this.#totals.cacheRead += sign * response.cacheRead;
  }
}
