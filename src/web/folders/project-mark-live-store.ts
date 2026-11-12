export interface ProjectMarks {
  favorites: ReadonlySet<string>;
}

const RETRY_DELAY_MS = 2000;

function favoritesOf(message: unknown): string[] | undefined {
  if (typeof message !== 'object' || message === null) return undefined;
  const { type, favorites } = message as { type?: unknown; favorites?: unknown };
  if (type !== 'project-marks' || !Array.isArray(favorites)) return undefined;
  return favorites.every((folder) => typeof folder === 'string') ? (favorites as string[]) : undefined;
}

export class ProjectMarkLiveStore {
  readonly #origin: string;
  readonly #listeners = new Set<() => void>();
  #marks: ProjectMarks = { favorites: new Set() };
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
        const favorites = favoritesOf(message);
        if (favorites === undefined) return;
        this.#marks = { favorites: new Set(favorites) };
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
