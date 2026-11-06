import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export const NAME_MAX_LENGTH = 200;
const NAMES_FILE = 'session-names.json';

export class NameTooLongError extends Error {
  constructor() {
    super(`A session name has at most ${NAME_MAX_LENGTH} characters`);
    this.name = 'NameTooLongError';
  }
}

type NameListener = (key: string, name: string | undefined) => void;

export function dataDirOf(env: NodeJS.ProcessEnv = process.env): string {
  if (env.AI_CLIENT_DATA_DIR) return env.AI_CLIENT_DATA_DIR;
  return path.join(env.XDG_DATA_HOME || path.join(homedir(), '.local/share'), 'ai-client');
}

export function nameLength(name: string): number {
  return Array.from(name).length;
}

export class SessionNameStore {
  readonly #file: string | undefined;
  readonly #names: Map<string, string>;
  readonly #listeners = new Set<NameListener>();
  #saving: Promise<void> = Promise.resolve();

  constructor(file?: string, names: Iterable<[string, string]> = []) {
    this.#file = file;
    this.#names = new Map(names);
  }

  static async load(dataDir: string): Promise<SessionNameStore> {
    const file = path.join(dataDir, NAMES_FILE);
    const names: [string, string][] = [];
    try {
      const saved: unknown = JSON.parse(await readFile(file, 'utf8'));
      if (typeof saved === 'object' && saved !== null && !Array.isArray(saved)) {
        for (const [key, name] of Object.entries(saved)) {
          if (typeof name === 'string' && name !== '') names.push([key, name]);
        }
      }
    } catch {
      // A missing or unreadable file means no names yet.
    }
    return new SessionNameStore(file, names);
  }

  get(key: string): string | undefined {
    return this.#names.get(key);
  }

  async set(key: string, name: string): Promise<void> {
    const trimmed = name.trim();
    if (nameLength(trimmed) > NAME_MAX_LENGTH) throw new NameTooLongError();
    if (this.#names.get(key) === (trimmed || undefined)) return;
    if (trimmed === '') this.#names.delete(key);
    else this.#names.set(key, trimmed);
    this.#notify(key, trimmed || undefined);
    await this.#save();
  }

  async move(from: string, to: string): Promise<void> {
    const name = this.#names.get(from);
    if (name === undefined || from === to) return;
    this.#names.delete(from);
    this.#names.set(to, name);
    this.#notify(from, undefined);
    this.#notify(to, name);
    await this.#save();
  }

  onChange(listener: NameListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #notify(key: string, name: string | undefined): void {
    for (const listener of this.#listeners) listener(key, name);
  }

  #save(): Promise<void> {
    const file = this.#file;
    if (file === undefined) return Promise.resolve();
    const write = async () => {
      await mkdir(path.dirname(file), { recursive: true });
      const temporary = `${file}.${process.pid}.tmp`;
      await writeFile(temporary, `${JSON.stringify(Object.fromEntries(this.#names), null, 2)}\n`);
      await rename(temporary, file);
    };
    this.#saving = this.#saving.catch(() => undefined).then(write);
    return this.#saving;
  }
}
