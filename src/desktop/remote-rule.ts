import type { AttentionEvent, AttentionSession } from './attention-client.js';

export const REMOTE_DELAY_MS = 60_000;

export interface RemoteSend {
  event: AttentionEvent;
  receivedAt: number;
}

export interface RemoteRuleOptions {
  onSend(send: RemoteSend): void;
  now?: () => number;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}

export class RemoteRule {
  readonly #receivedEventIds = new Set<string>();
  readonly #counts = new Map<string, { timer: unknown }>();
  readonly #onSend: RemoteRuleOptions['onSend'];
  readonly #now: () => number;
  readonly #setTimer: (callback: () => void, ms: number) => unknown;
  readonly #clearTimer: (timer: unknown) => void;

  constructor(options: RemoteRuleOptions) {
    this.#onSend = options.onSend;
    this.#now = options.now ?? Date.now;
    this.#setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
    this.#clearTimer = options.clearTimer ?? ((timer) => clearTimeout(timer as NodeJS.Timeout));
  }

  receiveEvent(event: AttentionEvent): void {
    if (event.kind !== 'needs_input' || this.#receivedEventIds.has(event.id)) return;
    this.#receivedEventIds.add(event.id);
    this.#stop(event.sessionId);
    const send: RemoteSend = { event, receivedAt: this.#now() };
    const count = { timer: undefined as unknown };
    this.#counts.set(event.sessionId, count);
    count.timer = this.#setTimer(() => {
      if (this.#counts.get(event.sessionId) !== count) return;
      this.#counts.delete(event.sessionId);
      this.#onSend(send);
    }, REMOTE_DELAY_MS);
  }

  receiveNeedsInput(sessions: readonly AttentionSession[]): void {
    const waiting = new Set(sessions.map((session) => session.sessionId));
    for (const sessionId of [...this.#counts.keys()]) {
      if (!waiting.has(sessionId)) this.#stop(sessionId);
    }
  }

  #stop(sessionId: string): void {
    const count = this.#counts.get(sessionId);
    if (count === undefined) return;
    this.#clearTimer(count.timer);
    this.#counts.delete(sessionId);
  }
}
