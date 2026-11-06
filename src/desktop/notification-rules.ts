import type { AttentionEvent, AttentionSession } from './attention-client.js';

export type NotificationCommand = { type: 'show'; event: AttentionEvent } | { type: 'close'; sessionId: string };

export class NotificationRules {
  readonly #receivedEventIds = new Set<string>();
  readonly #notifiedKinds = new Map<string, AttentionEvent['kind']>();
  #windowFocused: boolean;
  #openSessionId: string | null = null;

  constructor(options: { windowFocused?: boolean } = {}) {
    this.#windowFocused = options.windowFocused ?? false;
  }

  receiveEvent(event: AttentionEvent): NotificationCommand[] {
    if (this.#receivedEventIds.has(event.id)) return [];
    this.#receivedEventIds.add(event.id);
    if (this.#windowFocused) return [];
    this.#notifiedKinds.set(event.sessionId, event.kind);
    return [{ type: 'show', event }];
  }

  receiveNeedsInput(sessions: readonly AttentionSession[]): NotificationCommand[] {
    const waiting = new Set(sessions.map((session) => session.sessionId));
    const commands: NotificationCommand[] = [];
    for (const [sessionId, kind] of this.#notifiedKinds) {
      if (kind === 'needs_input' && !waiting.has(sessionId)) commands.push(this.#close(sessionId));
    }
    return commands;
  }

  setWindowFocused(focused: boolean): NotificationCommand[] {
    this.#windowFocused = focused;
    return this.#closeOpenSession();
  }

  setOpenSession(sessionId: string | null): NotificationCommand[] {
    this.#openSessionId = sessionId;
    return this.#closeOpenSession();
  }

  #closeOpenSession(): NotificationCommand[] {
    const sessionId = this.#openSessionId;
    if (!this.#windowFocused || sessionId === null || !this.#notifiedKinds.has(sessionId)) return [];
    return [this.#close(sessionId)];
  }

  #close(sessionId: string): NotificationCommand {
    this.#notifiedKinds.delete(sessionId);
    return { type: 'close', sessionId };
  }
}
