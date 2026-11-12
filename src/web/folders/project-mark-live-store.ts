export interface ProjectMarks {
  favorites: ReadonlySet<string>;
  removed: ReadonlyMap<string, string>;
}

const RETRY_DELAY_MS = 2000;

function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((removedAt) => typeof removedAt === 'string');
}

function marksOf(message: unknown): ProjectMarks | undefined {
  if (typeof message !== 'object' || message === null) return undefined;
  const { type, favorites, removed = {} } = message as { type?: unknown; favorites?: unknown; removed?: unknown };
  if (type !== 'project-marks' || !Array.isArray(favorites)) return undefined;
  if (!favorites.every((folder) => typeof folder === 'string') || !isStringRecord(removed)) return undefined;
  return { favorites: new Set(favorites as string[]), removed: new Map(Object.entries(removed)) };
}

export class ProjectMarkLiveStore {
  readonly #origin: string;
  readonly #listeners = new Set<() => void>();
  #marks: ProjectMarks = { favorites: new Set(), removed: new Map() };
  #stopCurrent: (() => void) | undefined;

  constructor(origin: string) {
    this.#origin = origin;
  }

  start(): void {
    this.stop();
    this.#connect();
  }

  #connect(): void {
    const socket = new WebSocket(`${this.#origin.replace(/^http/, 'ws')}/api/projects/marks`);
    const listeners = new AbortController();
    const fail = () => {
      if (listeners.signal.aborted) return;
      listeners.abort();
      socket.close();
      const retry = setTimeout(() => this.#connect(), RETRY_DELAY_MS);
      this.#stopCurrent = () => clearTimeout(retry);
    };

    socket.addEventListener(
      'message',
      (event: MessageEvent) => {
        let message: unknown;
        try {
          message = JSON.parse(String(event.data));
        } catch {
          return;
        }
        const marks = marksOf(message);
        if (marks === undefined) return;
        this.#marks = marks;
        for (const listener of this.#listeners) listener();
      },
      { signal: listeners.signal },
    );
    socket.addEventListener('close', fail, { signal: listeners.signal });
    socket.addEventListener('error', fail, { signal: listeners.signal });

    this.#stopCurrent = () => {
      listeners.abort();
      socket.close();
    };
  }

  stop(): void {
    this.#stopCurrent?.();
    this.#stopCurrent = undefined;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): ProjectMarks => this.#marks;
}

let pageStore: ProjectMarkLiveStore | undefined;

export function pageProjectMarkLiveStore(): ProjectMarkLiveStore {
  if (pageStore === undefined) {
    pageStore = new ProjectMarkLiveStore(window.location.origin);
    pageStore.start();
  }
  return pageStore;
}
