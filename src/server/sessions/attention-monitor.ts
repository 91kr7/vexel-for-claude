import { randomUUID } from 'node:crypto';
import type { ExternalSessionScanner } from '../external/external-session-scanner.js';
import { plainExcerpt } from './plain-excerpt.js';
import type { Session } from './session-registry.js';
import type { ChangeCause, SessionState, SessionStateTracker, SessionSummary } from './session-state-tracker.js';
import { type LastTurn, TurnReader } from './turn-reader.js';

export interface AttentionSession {
  sessionId: string;
  folder: string;
  label: string;
}

export interface AttentionEvent {
  id: string;
  sessionId: string;
  kind: 'needs_input' | 'turn_end' | 'session_end';
  folder: string;
  label: string;
  waitingTool?: string;
  excerpt?: string;
  error?: boolean;
}

type ProcessEnd = Pick<Session, 'exitCode' | 'signal' | 'stopRequested'>;

export interface AttentionMonitorSources {
  tracker: Pick<SessionStateTracker, 'list'> & {
    onChange(listener: (summary: SessionSummary, cause?: ChangeCause) => void): () => void;
    claudeSessionId?(sessionId: string): string | undefined;
  };
  scanner: Pick<ExternalSessionScanner, 'list' | 'onChange'>;
  turns?: Pick<TurnReader, 'lastTurn'>;
  registry?: { get(sessionId: string): ProcessEnd | undefined };
}

interface ObservedSession {
  id: string;
  folder: string;
  label: string;
  state: SessionState;
  waitingTool?: string;
}

type TurnRead = () => Promise<LastTurn>;

const NO_FINAL_RESPONSE: LastTurn = { interrupted: false };

export class AttentionMonitor {
  readonly #states = new Map<string, SessionState>();
  readonly #turnChecks = new Map<string, symbol>();
  readonly #needsInput = new Map<string, AttentionSession>();
  readonly #eventListeners = new Set<(event: AttentionEvent) => void>();
  readonly #listListeners = new Set<(sessions: AttentionSession[]) => void>();

  constructor({ tracker, scanner, turns = new TurnReader(), registry }: AttentionMonitorSources) {
    const hostedTurn = (session: ObservedSession) => () => {
      const claudeSessionId = tracker.claudeSessionId?.(session.id);
      return claudeSessionId === undefined ? Promise.resolve(NO_FINAL_RESPONSE) : turns.lastTurn(session.folder, claudeSessionId);
    };
    for (const session of [...tracker.list(), ...scanner.list()]) this.#observe(session);
    tracker.onChange((session, cause?: ChangeCause) => {
      const stopped = cause?.type === 'hook' && cause.hookEventName === 'Stop';
      const seen = this.#states.has(session.id);
      this.#observe(session, stopped ? hostedTurn(session) : undefined);
      if (seen && cause?.type === 'exit') this.#checkSessionEnd(session, registry?.get(session.id));
    });
    scanner.onChange((change) => {
      if (change.type === 'session') {
        const { folder, id } = change.session;
        this.#observe(change.session, () => turns.lastTurn(folder, id));
      } else {
        this.#forget(change.id);
      }
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

  #observe(session: ObservedSession, readTurn?: TurnRead): void {
    const previous = this.#states.get(session.id);
    this.#states.set(session.id, session.state);
    if (previous !== session.state) this.#turnChecks.delete(session.id);
    const needsInput = session.state === 'needs_input';
    if (needsInput ? this.#enterList(session) : this.#needsInput.delete(session.id)) this.#notifyList();
    if (needsInput && previous !== undefined && previous !== 'needs_input') {
      const event = this.#event(session, 'needs_input');
      if (session.waitingTool !== undefined) event.waitingTool = session.waitingTool;
      this.#emit(event);
    } else if (previous === 'working' && session.state === 'idle' && readTurn) {
      void this.#checkTurnEnd(session, readTurn);
    }
  }

  async #checkTurnEnd(session: ObservedSession, readTurn: TurnRead): Promise<void> {
    const check = Symbol(session.id);
    this.#turnChecks.set(session.id, check);
    const turn = await readTurn().catch(() => NO_FINAL_RESPONSE);
    if (this.#turnChecks.get(session.id) !== check) return;
    this.#turnChecks.delete(session.id);
    if (turn.interrupted) return;
    const event = this.#event(session, 'turn_end');
    const excerpt = turn.finalResponse === undefined ? '' : plainExcerpt(turn.finalResponse);
    if (excerpt !== '') event.excerpt = excerpt;
    this.#emit(event);
  }

  #checkSessionEnd(session: ObservedSession, ended: ProcessEnd | undefined): void {
    if (!ended || ended.stopRequested) return;
    if (ended.signal === undefined && ended.exitCode === 0) return;
    this.#emit({ ...this.#event(session, 'session_end'), error: ended.signal === undefined });
  }

  #event(session: ObservedSession, kind: AttentionEvent['kind']): AttentionEvent {
    return { id: randomUUID(), sessionId: session.id, kind, folder: session.folder, label: session.label };
  }

  #emit(event: AttentionEvent): void {
    for (const listener of this.#eventListeners) listener({ ...event });
  }

  #forget(sessionId: string): void {
    this.#states.delete(sessionId);
    this.#turnChecks.delete(sessionId);
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
