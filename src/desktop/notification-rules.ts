import type { AttentionEvent, AttentionSession } from './attention-client.js';

const BURST_MS = 5_000;

export type NotificationCommand =
  | { type: 'show'; event: AttentionEvent; replaces?: string }
  | {
      type: 'show-group';
      sessionId: string;
      kind: AttentionEvent['kind'];
      events: AttentionEvent[];
      replaces?: string;
    }
  | { type: 'close'; sessionId: string };

interface Notice {
  /** Latest event first, one per session. */
  lines: AttentionEvent[];
  /** The session it belongs to at its last command. */
  ownerId: string;
}

export class NotificationRules {
  readonly #receivedEventIds = new Set<string>();
  readonly #notices = new Set<Notice>();
  readonly #now: () => number;
  #burst: { notice: Notice; startedAt: number } | undefined;
  #windowFocused: boolean;
  #openSessionId: string | null = null;

  constructor(options: { windowFocused?: boolean; now?: () => number } = {}) {
    this.#windowFocused = options.windowFocused ?? false;
    this.#now = options.now ?? Date.now;
  }

  receiveEvent(event: AttentionEvent): NotificationCommand[] {
    if (this.#receivedEventIds.has(event.id)) return [];
    this.#receivedEventIds.add(event.id);
    if (this.#windowFocused) return [];
    const now = this.#now();
    const own = this.#noticeOf(event.sessionId);
    const commands: NotificationCommand[] = [];
    let target = this.#runningBurst(now);
    if (target === undefined && own?.lines.length === 1) {
      target = own;
      this.#burst = { notice: own, startedAt: now };
    } else if (target === undefined) {
      target = { lines: [], ownerId: event.sessionId };
      this.#notices.add(target);
      this.#burst = { notice: target, startedAt: now };
    }
    if (own !== undefined && own !== target) commands.push(this.#leave(own, event.sessionId));
    target.lines = [event, ...target.lines.filter((line) => line.sessionId !== event.sessionId)];
    commands.push(this.#commandOf(target));
    return commands;
  }

  receiveNeedsInput(sessions: readonly AttentionSession[]): NotificationCommand[] {
    const waiting = new Set(sessions.map((session) => session.sessionId));
    const commands: NotificationCommand[] = [];
    for (const notice of [...this.#notices]) {
      const kept = notice.lines.filter((line) => line.kind !== 'needs_input' || waiting.has(line.sessionId));
      if (kept.length === notice.lines.length) continue;
      notice.lines = kept;
      commands.push(this.#commandOf(notice));
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

  notificationClosed(sessionId: string): void {
    for (const notice of this.#notices) if (notice.ownerId === sessionId) this.#notices.delete(notice);
  }

  #closeOpenSession(): NotificationCommand[] {
    const sessionId = this.#openSessionId;
    const notice = sessionId === null ? undefined : this.#noticeOf(sessionId);
    if (!this.#windowFocused || sessionId === null || notice === undefined) return [];
    return [this.#leave(notice, sessionId)];
  }

  #runningBurst(now: number): Notice | undefined {
    const burst = this.#burst;
    if (burst === undefined || !this.#notices.has(burst.notice) || now - burst.startedAt > BURST_MS) return undefined;
    return burst.notice;
  }

  #noticeOf(sessionId: string): Notice | undefined {
    for (const notice of this.#notices) if (notice.lines.some((line) => line.sessionId === sessionId)) return notice;
    return undefined;
  }

  #leave(notice: Notice, sessionId: string): NotificationCommand {
    notice.lines = notice.lines.filter((line) => line.sessionId !== sessionId);
    return this.#commandOf(notice);
  }

  #commandOf(notice: Notice): NotificationCommand {
    const previousOwnerId = notice.ownerId;
    const [latest, ...older] = notice.lines;
    if (latest === undefined) {
      this.#notices.delete(notice);
      return { type: 'close', sessionId: previousOwnerId };
    }
    notice.ownerId = latest.sessionId;
    const replaces = previousOwnerId === latest.sessionId ? {} : { replaces: previousOwnerId };
    if (older.length === 0) return { type: 'show', event: latest, ...replaces };
    const kind = notice.lines.some((line) => line.kind === 'needs_input') ? 'needs_input' : latest.kind;
    return { type: 'show-group', sessionId: latest.sessionId, kind, events: [...notice.lines], ...replaces };
  }
}
