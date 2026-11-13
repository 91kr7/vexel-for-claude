import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MARKS_FILE = 'project-marks.json';

type MarkListener = () => void;

function savedFavoritesOf(saved: unknown): string[] {
  const favorites = (saved as { favorites?: unknown }).favorites;
  return Array.isArray(favorites) ? favorites.filter((folder): folder is string => typeof folder === 'string') : [];
}

function savedRemovalsOf(saved: unknown): [string, string][] {
  const removed = (saved as { removed?: unknown }).removed;
  if (typeof removed !== 'object' || removed === null || Array.isArray(removed)) return [];
  return Object.entries(removed).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
}

export class ProjectMarkStore {
  readonly #file: string | undefined;
  readonly #favorites: Set<string>;
  readonly #removed: Map<string, string>;
  readonly #listeners = new Set<MarkListener>();
  #saving: Promise<void> = Promise.resolve();

  constructor(file?: string, favorites: Iterable<string> = [], removed: Iterable<[string, string]> = []) {
    this.#file = file;
    this.#favorites = new Set(favorites);
    this.#removed = new Map(removed);
  }

  static async load(dataDir: string): Promise<ProjectMarkStore> {
    const file = path.join(dataDir, MARKS_FILE);
    try {
      const saved: unknown = JSON.parse(await readFile(file, 'utf8'));
      if (typeof saved === 'object' && saved !== null) {
        return new ProjectMarkStore(file, savedFavoritesOf(saved), savedRemovalsOf(saved));
      }
    } catch {
      // A missing or unreadable file means no marks yet.
    }
    return new ProjectMarkStore(file);
  }

  isFavorite(folder: string): boolean {
    return this.#favorites.has(folder);
  }

  favorites(): string[] {
    return [...this.#favorites];
  }

  removals(): Record<string, string> {
    return Object.fromEntries(this.#removed);
  }

  async setFavorite(folder: string, favorite: boolean): Promise<void> {
    if (this.#favorites.has(folder) === favorite) return;
    if (favorite) this.#favorites.add(folder);
    else this.#favorites.delete(folder);
    await this.#changed();
  }

  async remove(folder: string): Promise<void> {
    this.#removed.set(folder, new Date().toISOString());
    this.#favorites.delete(folder);
    await this.#changed();
  }

  async clearRemoval(folder: string): Promise<void> {
    if (!this.#removed.delete(folder)) return;
    await this.#changed();
  }

  onChange(listener: MarkListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #changed(): Promise<void> {
    for (const listener of this.#listeners) listener();
    return this.#save();
  }

  #save(): Promise<void> {
    const file = this.#file;
    if (file === undefined) return Promise.resolve();
    const write = async () => {
      await mkdir(path.dirname(file), { recursive: true });
      const temporary = `${file}.${process.pid}.tmp`;
      const marks = { favorites: [...this.#favorites], removed: this.removals() };
      await writeFile(temporary, `${JSON.stringify(marks, null, 2)}\n`);
      await rename(temporary, file);
    };
    this.#saving = this.#saving.catch(() => undefined).then(write);
    return this.#saving;
  }
}
