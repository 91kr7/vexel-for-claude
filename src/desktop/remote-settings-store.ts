import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface RemoteSettings {
  enabled: boolean;
  topicUrl: string;
  token: string;
}

export const DEFAULT_REMOTE_SETTINGS: Readonly<RemoteSettings> = Object.freeze({ enabled: false, topicUrl: '', token: '' });

export function parseRemoteSettings(value: unknown): RemoteSettings | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { enabled, topicUrl, token } = value as Record<string, unknown>;
  if (typeof enabled !== 'boolean' || typeof topicUrl !== 'string' || typeof token !== 'string') return undefined;
  return { enabled, topicUrl, token };
}

export class RemoteSettingsStore {
  readonly #filePath: string;
  #lastSave: Promise<void> = Promise.resolve();

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  async read(): Promise<RemoteSettings> {
    try {
      return parseRemoteSettings(JSON.parse(await readFile(this.#filePath, 'utf8'))) ?? { ...DEFAULT_REMOTE_SETTINGS };
    } catch {
      return { ...DEFAULT_REMOTE_SETTINGS };
    }
  }

  save(settings: RemoteSettings): Promise<void> {
    const { enabled, topicUrl, token } = settings;
    const content = JSON.stringify({ enabled, topicUrl, token });
    const write = async () => {
      await mkdir(path.dirname(this.#filePath), { recursive: true });
      // Before the write: the token never sits in a file with a wider mode.
      await chmod(this.#filePath, 0o600).catch(() => undefined);
      await writeFile(this.#filePath, content, { mode: 0o600 });
    };
    const saved = this.#lastSave.then(write, write);
    this.#lastSave = saved.catch(() => undefined);
    return saved;
  }
}
