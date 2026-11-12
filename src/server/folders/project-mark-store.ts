import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MARKS_FILE = 'project-marks.json';

type MarkListener = () => void;

export class ProjectMarkStore {
  readonly #file: string | undefined;
  readonly #favorites: Set<string>;
  readonly #listeners = new Set<MarkListener>();
  #saving: Promise<void> = Promise.resolve();

  constructor(file?: string, favorites: Iterable<string> = []) {
    this.#file = file;
    this.#favorites = new Set(favorites);
  }

  static async load(dataDir: string): Promise<ProjectMarkStore> {
    const file = path.join(dataDir, MARKS_FILE);
    const favorites: string[] = [];
    try {
      const saved: unknown = JSON.parse(await readFile(file, 'utf8'));
      const savedFavorites = typeof saved === 'object' && saved !== null ? (saved as { favorites?: unknown }).favorites : undefined;
      if (Array.isArray(savedFavorites)) {
        for (const folder of savedFavorites) {
          if (typeof folder === 'string') favorites.push(folder);
        }
      }
    } catch {
      // A missing or unreadable file means no marks yet.
    }
    return new ProjectMarkStore(file, favorites);
  }

  isFavorite(folder: string): boolean {
    return this.#favorites.has(folder);
  }

  favorites(): string[] {
    return [...this.#favorites];
  }

  async setFavorite(folder: string, favorite: boolean): Promise<void> {
    if (this.#favorites.has(folder) === favorite) return;
    if (favorite) this.#favorites.add(folder);
    else this.#favorites.delete(folder);
    for (const listener of this.#listeners) listener();
    await this.#save();
  }

  onChange(listener: MarkListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #save(): Promise<void> {
    const file = this.#file;
    if (file === undefined) return Promise.resolve();
    const write = async () => {
      await mkdir(path.dirname(file), { recursive: true });
      const temporary = `${file}.${process.pid}.tmp`;
      await writeFile(temporary, `${JSON.stringify({ favorites: [...this.#favorites] }, null, 2)}\n`);
      await rename(temporary, file);
    };
    this.#saving = this.#saving.catch(() => undefined).then(write);
    return this.#saving;
  }
}
