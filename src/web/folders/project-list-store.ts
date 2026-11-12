import { useSyncExternalStore } from 'react';

export interface Project {
  folder: string;
  lastActivity: string;
  available: boolean;
}

export type ProjectListState = { kind: 'loading' } | { kind: 'ready'; projects: Project[] } | { kind: 'error' };

interface PastSessionGroupBody {
  folder: string;
  available?: unknown;
  sessions: { lastActivity: string }[];
}

type FetchGroups = () => Promise<unknown>;

const LOADING: ProjectListState = { kind: 'loading' };
const ERROR: ProjectListState = { kind: 'error' };

async function fetchPastSessionGroups(): Promise<unknown> {
  const response = await fetch('/api/past-sessions');
  if (!response.ok) throw new Error(`GET /api/past-sessions answered ${response.status}`);
  return response.json();
}

function projectsOf(groups: PastSessionGroupBody[]): Project[] {
  return groups.flatMap((group) => {
    const first = group.sessions[0];
    if (first === undefined) return [];
    return [{ folder: group.folder, lastActivity: first.lastActivity, available: group.available !== false }];
  });
}

export class ProjectListStore {
  readonly #fetchGroups: FetchGroups;
  readonly #listeners = new Set<() => void>();
  #state: ProjectListState = LOADING;
  #lastLoad = 0;

  constructor(fetchGroups: FetchGroups = fetchPastSessionGroups) {
    this.#fetchGroups = fetchGroups;
  }

  load(): void {
    const loadId = ++this.#lastLoad;
    if (this.#state.kind === 'error') this.#set(LOADING);
    this.#fetchGroups().then(
      (body) => {
        if (loadId !== this.#lastLoad) return;
        if (Array.isArray(body)) this.#set({ kind: 'ready', projects: projectsOf(body as PastSessionGroupBody[]) });
        else this.#fail();
      },
      () => {
        if (loadId === this.#lastLoad) this.#fail();
      },
    );
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): ProjectListState => this.#state;

  #fail(): void {
    if (this.#state.kind !== 'ready') this.#set(ERROR);
  }

  #set(state: ProjectListState): void {
    if (state === this.#state) return;
    this.#state = state;
    for (const listener of this.#listeners) listener();
  }
}

let pageStore: ProjectListStore | undefined;

export function pageProjectListStore(): ProjectListStore {
  pageStore ??= new ProjectListStore();
  return pageStore;
}

export function useProjectList(store: ProjectListStore = pageProjectListStore()): ProjectListState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
