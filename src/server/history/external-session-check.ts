import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { defaultClaudeDir } from './session-history.js';

export interface ExternalSessionCheckOptions {
  claudeDir?: string;
  procDir?: string;
}

// Only <pid>.json: the <pid>.<hash>.key files in the same folder hold credentials.
const SESSION_FILE_PATTERN = /^(\d+)\.json$/;

export class ExternalSessionCheck {
  readonly #sessionsDir: string;
  readonly #procDir: string;

  constructor(options: ExternalSessionCheckOptions = {}) {
    this.#sessionsDir = path.join(options.claudeDir ?? defaultClaudeDir(), 'sessions');
    this.#procDir = options.procDir ?? '/proc';
  }

  async runningSessionIds(hostedPids: Iterable<number>): Promise<Set<string>> {
    const hosted = new Set(hostedPids);
    const names = await readdir(this.#sessionsDir).catch(() => [] as string[]);
    const ids = new Set<string>();
    await Promise.all(
      names.map(async (name) => {
        const pid = SESSION_FILE_PATTERN.exec(name)?.[1];
        if (pid === undefined || hosted.has(Number(pid))) return;
        const alive = await stat(path.join(this.#procDir, pid)).then(
          () => true,
          () => false,
        );
        if (!alive) return;
        const sessionId = await readFile(path.join(this.#sessionsDir, name), { encoding: 'utf8', flag: 'r' })
          .then((text) => (JSON.parse(text) as { sessionId?: unknown }).sessionId)
          .catch(() => undefined);
        if (typeof sessionId === 'string') ids.add(sessionId);
      }),
    );
    return ids;
  }
}
