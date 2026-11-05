import { randomUUID } from 'node:crypto';
import * as pty from 'node-pty';
import { TerminalMirror } from './terminal-mirror.js';

const DEFAULT_COMMAND = 'claude';
const INITIAL_COLS = 120;
const INITIAL_ROWS = 30;
const DEFAULT_STOP_TIMEOUT_MS = 5000;
export const SESSION_ID_VARIABLE = 'AI_CLIENT_SESSION_ID';

export interface SessionViewer {
  send(data: string): void;
  end(): void;
}

export interface ResumeInfo {
  sessionId: string;
  firstUserMessage?: string | null;
}

export class Session {
  readonly id: string;
  readonly cwd: string;
  readonly pid: number;
  readonly resumedFrom: ResumeInfo | undefined;
  readonly #pty: pty.IPty;
  readonly #mirror: TerminalMirror;
  readonly #viewers = new Set<SessionViewer>();
  readonly #exitListeners = new Set<() => void>();
  readonly #stopTimeoutMs: number;
  #killTimer: NodeJS.Timeout | undefined;
  #exited = false;

  constructor(
    id: string,
    cwd: string,
    command: string,
    args: string[],
    stopTimeoutMs = DEFAULT_STOP_TIMEOUT_MS,
    resumedFrom?: ResumeInfo,
  ) {
    this.id = id;
    this.cwd = cwd;
    this.resumedFrom = resumedFrom;
    this.#stopTimeoutMs = stopTimeoutMs;
    this.#mirror = new TerminalMirror(INITIAL_COLS, INITIAL_ROWS);
    this.#pty = pty.spawn(command, args, {
      name: 'xterm-256color',
      cols: INITIAL_COLS,
      rows: INITIAL_ROWS,
      cwd,
      env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', [SESSION_ID_VARIABLE]: id },
    });
    this.pid = this.#pty.pid;
    this.#pty.onData((data) => {
      this.#mirror.write(data);
      for (const viewer of this.#viewers) viewer.send(data);
    });
    this.#pty.onExit(() => {
      this.#exited = true;
      clearTimeout(this.#killTimer);
      for (const viewer of this.#viewers) viewer.end();
      this.#viewers.clear();
      for (const listener of this.#exitListeners) listener();
      this.#exitListeners.clear();
    });
  }

  onExit(listener: () => void): () => void {
    if (!this.#exited) this.#exitListeners.add(listener);
    return () => this.#exitListeners.delete(listener);
  }

  get exited(): boolean {
    return this.#exited;
  }

  write(data: string): void {
    if (!this.#exited) this.#pty.write(data);
  }

  stop(): void {
    if (this.#exited || this.#killTimer) return;
    this.#pty.kill('SIGTERM');
    this.#killTimer = setTimeout(() => {
      if (!this.#exited) this.#pty.kill('SIGKILL');
    }, this.#stopTimeoutMs);
  }

  resize(cols: number, rows: number): void {
    if (this.#exited) return;
    this.#pty.resize(cols, rows);
    this.#mirror.resize(cols, rows);
  }

  attach(viewer: SessionViewer): () => void {
    let detached = false;
    const pending: string[] = [];
    let ended = false;
    const buffering: SessionViewer = {
      send: (data) => pending.push(data),
      end: () => {
        ended = true;
      },
    };
    // Live output is buffered until the snapshot is sent, so nothing is lost or repeated.
    this.#viewers.add(buffering);
    void this.#mirror.snapshot().then((snapshot) => {
      this.#viewers.delete(buffering);
      if (detached) return;
      viewer.send(snapshot);
      for (const data of pending) viewer.send(data);
      if (ended || this.#exited) {
        viewer.end();
        return;
      }
      this.#viewers.add(viewer);
    });
    return () => {
      detached = true;
      this.#viewers.delete(buffering);
      this.#viewers.delete(viewer);
    };
  }
}

export interface SessionRegistryOptions {
  command?: string;
  settingsPath?: string;
  stopTimeoutMs?: number;
}

export class SessionRegistry {
  readonly #command: string;
  readonly #args: string[];
  readonly #stopTimeoutMs: number | undefined;
  readonly #sessions = new Map<string, Session>();
  readonly #startListeners = new Set<(session: Session) => void>();

  constructor(options: SessionRegistryOptions = {}) {
    this.#command = options.command ?? (process.env.AI_CLIENT_CLAUDE_CLI || DEFAULT_COMMAND);
    this.#args = options.settingsPath ? ['--settings', options.settingsPath] : [];
    this.#stopTimeoutMs = options.stopTimeoutMs;
  }

  start(cwd: string, resume?: ResumeInfo): Session {
    const args = resume ? [...this.#args, '--resume', resume.sessionId] : this.#args;
    const session = new Session(randomUUID(), cwd, this.#command, args, this.#stopTimeoutMs, resume);
    this.#sessions.set(session.id, session);
    for (const listener of this.#startListeners) listener(session);
    return session;
  }

  onSessionStart(listener: (session: Session) => void): () => void {
    this.#startListeners.add(listener);
    return () => this.#startListeners.delete(listener);
  }

  get(id: string): Session | undefined {
    return this.#sessions.get(id);
  }

  list(): Session[] {
    return [...this.#sessions.values()];
  }

  hostedPids(): number[] {
    return this.list()
      .filter((session) => !session.exited)
      .map((session) => session.pid);
  }
}
