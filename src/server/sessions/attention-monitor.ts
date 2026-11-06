import { randomUUID } from 'node:crypto';
import type { ExternalSessionScanner } from '../external/external-session-scanner.js';
import type { SessionState, SessionStateTracker } from './session-state-tracker.js';

export interface AttentionSession {
  sessionId: string;
  folder: string;
  label: string;
}

export interface AttentionEvent {
  id: string;
  sessionId: string;
  kind: 'needs_input';
  folder: string;
  label: string;
  waitingTool?: string;
}

export interface AttentionMonitorSources {
  tracker: Pick<SessionStateTracker, 'list' | 'onChange'>;
  scanner: Pick<ExternalSessionScanner, 'list' | 'onChange'>;
}

interface ObservedSession {
  id: string;
  folder: string;
  label: string;
  state: SessionState;
  waitingTool?: string;
}

export class AttentionMonitor {
  readonly #states = new Map<string, SessionState>();
  readonly #needsInput = new Map<string, AttentionSession>();
  readonly #eventListeners = new Set<(event: AttentionEvent) => void>();
  readonly #listListeners = new Set<(sessions: AttentionSession[]) => void>();

  constructor({ tracker, scanner }: AttentionMonitorSources) {
    for (const session of [...tracker.list(), ...scanner.list()]) this.#observe(session);
    tracker.onChange((session) => this.#observe(session));
    scanner.onChange((change) => {
      if (change.type === 'session') this.#observe(change.session);
      else this.#forget(change.id);
    });
  }

  needsInput(): AttentionSession[] {
    return [...this.#needsInput.values()].map((session) => ({ ...session }));
  }

  onEvent(listener: (event: AttentionEvent) => void): () => void {
    this.#eventListeners.add(listener);
    return () => this.#eventListeners.delete(listener);
  }

  onNeedsInputChange(listener: (sessions: AttentionSession[]) => void): () => void {
    this.#listListeners.add(listener);
    return () => this.#listListeners.delete(listener);
  }

  #observe(session: ObservedSession): void {
    const previous = this.#states.get(session.id);
    this.#states.set(session.id, session.state);
    const needsInput = session.state === 'needs_input';
    if (needsInput ? this.#enterList(session) : this.#needsInput.delete(session.id)) this.#notifyList();
    if (!needsInput || previous === undefined || previous === 'needs_input') return;
    const event: AttentionEvent = {
      id: randomUUID(),
      sessionId: session.id,
      kind: 'needs_input',
      folder: session.folder,
      label: session.label,
    };
    if (session.waitingTool !== undefined) event.waitingTool = session.waitingTool;
    for (const listener of this.#eventListeners) listener({ ...event });
  }

  #forget(sessionId: string): void {
    this.#states.delete(sessionId);
    if (this.#needsInput.delete(sessionId)) this.#notifyList();
  }

  #enterList(session: ObservedSession): boolean {
    const known = this.#needsInput.get(session.id);
    if (known && known.folder === session.folder && known.label === session.label) return false;
    this.#needsInput.set(session.id, { sessionId: session.id, folder: session.folder, label: session.label });
    return true;
  }

  #notifyList(): void {
    for (const listener of this.#listListeners) listener(this.needsInput());
  }
}
