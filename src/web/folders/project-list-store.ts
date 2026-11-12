import { useSyncExternalStore } from 'react';
import { pageProjectMarkLiveStore, type ProjectMarkLiveStore, type ProjectMarks } from './project-mark-live-store';

export interface Project {
  folder: string;
  lastActivity: string;
  available: boolean;
  favorite: boolean;
}

export type ProjectListState = { kind: 'loading' } | { kind: 'ready'; projects: Project[] } | { kind: 'error' };

interface PastSessionGroupBody {
  folder: string;
  available?: unknown;
  sessions: { lastActivity: string }[];
}

type FetchGroups = () => Promise<unknown>;

type MarkSnapshot = Pick<ProjectMarks, 'favorites'> & Partial<Pick<ProjectMarks, 'removed'>>;

type MarkSource = Pick<ProjectMarkLiveStore, 'subscribe'> & { getSnapshot: () => MarkSnapshot };

type LoadedProject = Omit<Project, 'favorite'>;

const LOADING: ProjectListState = { kind: 'loading' };
const ERROR: ProjectListState = { kind: 'error' };

async function fetchPastSessionGroups(): Promise<unknown> {
  const response = await fetch('/api/past-sessions');
  if (!response.ok) throw new Error(`GET /api/past-sessions answered ${response.status}`);
  return response.json();
}

function loadedProjectsOf(groups: PastSessionGroupBody[]): LoadedProject[] {
  return groups.flatMap((group) => {
    const first = group.sessions[0];
    if (first === undefined) return [];
    return [{ folder: group.folder, lastActivity: first.lastActivity, available: group.available !== false }];
  });
}

function isRemoved(project: LoadedProject, marks: MarkSnapshot | undefined): boolean {
  const removedAt = marks?.removed?.get(project.folder);
  return removedAt !== undefined && Date.parse(removedAt) >= Date.parse(project.lastActivity);
}

function markedProjectsOf(loaded: LoadedProject[], marks: MarkSnapshot | undefined): Project[] {
  const projects = loaded
    .filter((project) => !isRemoved(project, marks))
    .map((project) => ({ ...project, favorite: marks?.favorites.has(project.folder) === true }));
  return [...projects.filter((project) => project.favorite), ...projects.filter((project) => !project.favorite)];
}

export class ProjectListStore {
  readonly #fetchGroups: FetchGroups;
  readonly #marks: MarkSource | undefined;
  readonly #listeners = new Set<() => void>();
  #state: ProjectListState = LOADING;
  #loaded: LoadedProject[] = [];
  #lastLoad = 0;

  constructor(fetchGroups: FetchGroups = fetchPastSessionGroups, marks?: MarkSource) {
    this.#fetchGroups = fetchGroups;
    this.#marks = marks;
    marks?.subscribe(() => {
      if (this.#state.kind === 'ready') this.#showLoaded();
    });
  }

  load(): void {
    const loadId = ++this.#lastLoad;
    if (this.#state.kind === 'error') this.#set(LOADING);
    this.#fetchGroups().then(
      (body) => {
        if (loadId !== this.#lastLoad) return;
        if (!Array.isArray(body)) return this.#fail();
        this.#loaded = loadedProjectsOf(body as PastSessionGroupBody[]);
        this.#showLoaded();
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

  #showLoaded(): void {
    this.#set({ kind: 'ready', projects: markedProjectsOf(this.#loaded, this.#marks?.getSnapshot()) });
  }

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
  pageStore ??= new ProjectListStore(fetchPastSessionGroups, pageProjectMarkLiveStore());
  return pageStore;
}

export function useProjectList(store: ProjectListStore = pageProjectListStore()): ProjectListState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
