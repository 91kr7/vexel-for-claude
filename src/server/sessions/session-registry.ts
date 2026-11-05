import { randomUUID } from 'node:crypto';
import * as pty from 'node-pty';
import { TerminalMirror } from './terminal-mirror.js';

const DEFAULT_COMMAND = 'claude';
const INITIAL_COLS = 120;
const INITIAL_ROWS = 30;

export interface SessionViewer {
  send(data: string): void;
  end(): void;
}

export class Session {
  readonly id: string;
  readonly cwd: string;
  readonly #pty: pty.IPty;
  readonly #mirror: TerminalMirror;
  readonly #viewers = new Set<SessionViewer>();
  #exited = false;

  constructor(id: string, cwd: string, command: string) {
    this.id = id;
    this.cwd = cwd;
    this.#mirror = new TerminalMirror(INITIAL_COLS, INITIAL_ROWS);
    this.#pty = pty.spawn(command, [], {
      name: 'xterm-256color',
      cols: INITIAL_COLS,
      rows: INITIAL_ROWS,
      cwd,
      env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
    });
    this.#pty.onData((data) => {
      this.#mirror.write(data);
      for (const viewer of this.#viewers) viewer.send(data);
    });
    this.#pty.onExit(() => {
      this.#exited = true;
      for (const viewer of this.#viewers) viewer.end();
      this.#viewers.clear();
    });
  }

  get exited(): boolean {
    return this.#exited;
  }

  write(data: string): void {
    if (!this.#exited) this.#pty.write(data);
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
}

export class SessionRegistry {
  readonly #command: string;
  readonly #sessions = new Map<string, Session>();

  constructor(options: SessionRegistryOptions = {}) {
    this.#command = options.command ?? (process.env.AI_CLIENT_CLAUDE_CLI || DEFAULT_COMMAND);
  }

  start(cwd: string): Session {
    const session = new Session(randomUUID(), cwd, this.#command);
    this.#sessions.set(session.id, session);
    return session;
  }

  get(id: string): Session | undefined {
    return this.#sessions.get(id);
  }
}
