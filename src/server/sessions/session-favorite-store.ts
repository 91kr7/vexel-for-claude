import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const FAVORITES_FILE = 'session-favorites.json';

type FavoriteListener = (key: string, favorite: boolean) => void;

export class SessionFavoriteStore {
  readonly #file: string | undefined;
  readonly #keys: Set<string>;
  readonly #listeners = new Set<FavoriteListener>();
  #saving: Promise<void> = Promise.resolve();

  constructor(file?: string, keys: Iterable<string> = []) {
    this.#file = file;
    this.#keys = new Set(keys);
  }

  static async load(dataDir: string): Promise<SessionFavoriteStore> {
    const file = path.join(dataDir, FAVORITES_FILE);
    const keys: string[] = [];
    try {
      const saved: unknown = JSON.parse(await readFile(file, 'utf8'));
      if (typeof saved === 'object' && saved !== null && !Array.isArray(saved)) {
        for (const [key, favorite] of Object.entries(saved)) {
          if (favorite === true) keys.push(key);
        }
      }
    } catch {
      // A missing or unreadable file means no favorites yet.
    }
    return new SessionFavoriteStore(file, keys);
  }

  has(key: string): boolean {
    return this.#keys.has(key);
  }

  async set(key: string, favorite: boolean): Promise<void> {
    if (this.#keys.has(key) === favorite) return;
    if (favorite) this.#keys.add(key);
    else this.#keys.delete(key);
    this.#notify(key, favorite);
    await this.#save();
  }

  async move(from: string, to: string): Promise<void> {
    if (!this.#keys.has(from) || from === to) return;
    const alreadyMarked = this.#keys.has(to);
    this.#keys.delete(from);
    this.#keys.add(to);
    this.#notify(from, false);
    if (!alreadyMarked) this.#notify(to, true);
    await this.#save();
  }

  onChange(listener: FavoriteListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #notify(key: string, favorite: boolean): void {
    for (const listener of this.#listeners) listener(key, favorite);
  }

  #save(): Promise<void> {
    const file = this.#file;
    if (file === undefined) return Promise.resolve();
    const write = async () => {
      await mkdir(path.dirname(file), { recursive: true });
      const temporary = `${file}.${process.pid}.tmp`;
      const saved = Object.fromEntries([...this.#keys].map((key) => [key, true]));
      await writeFile(temporary, `${JSON.stringify(saved, null, 2)}\n`);
      await rename(temporary, file);
    };
    this.#saving = this.#saving.catch(() => undefined).then(write);
    return this.#saving;
  }
}
