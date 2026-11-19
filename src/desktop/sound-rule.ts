import type { AttentionEvent } from './attention-client.js';

const SOUND_WINDOW_MS = 5_000;

export class SoundRule {
  readonly #receivedEventIds = new Set<string>();
  readonly #now: () => number;
  #lastPlayedAt: number | undefined;

  constructor(options: { now?: () => number } = {}) {
    this.#now = options.now ?? Date.now;
  }

  receiveEvent(event: AttentionEvent): boolean {
    if (event.kind !== 'needs_input' || this.#receivedEventIds.has(event.id)) return false;
    this.#receivedEventIds.add(event.id);
    const now = this.#now();
    if (this.#lastPlayedAt !== undefined && now - this.#lastPlayedAt <= SOUND_WINDOW_MS) return false;
    this.#lastPlayedAt = now;
    return true;
  }
}
