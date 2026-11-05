import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { defaultClaudeDir } from './session-history.js';

export interface ExternalSessionCheckOptions {
  claudeDir?: string;
  procDir?: string;
}

export interface RunningSessionFile {
  pid: number;
  sessionId: string;
  cwd?: string;
  kind?: string;
  status?: string;
  updatedAt?: number;
}

// Only <pid>.json: the <pid>.<hash>.key files in the same folder hold credentials.
const SESSION_FILE_PATTERN = /^(\d+)\.json$/;

function parseSessionFile(pid: number, text: string): RunningSessionFile | undefined {
  const data = JSON.parse(text) as Record<string, unknown>;
  if (typeof data?.sessionId !== 'string') return undefined;
  const file: RunningSessionFile = { pid, sessionId: data.sessionId };
  if (typeof data.cwd === 'string') file.cwd = data.cwd;
  if (typeof data.kind === 'string') file.kind = data.kind;
  if (typeof data.status === 'string') file.status = data.status;
  if (typeof data.updatedAt === 'number') file.updatedAt = data.updatedAt;
  return file;
}

export class ExternalSessionCheck {
  readonly #sessionsDir: string;
  readonly #procDir: string;

  constructor(options: ExternalSessionCheckOptions = {}) {
    this.#sessionsDir = path.join(options.claudeDir ?? defaultClaudeDir(), 'sessions');
    this.#procDir = options.procDir ?? '/proc';
  }

  async runningSessionIds(hostedPids: Iterable<number>): Promise<Set<string>> {
    return new Set((await this.runningSessions(hostedPids)).map((file) => file.sessionId));
  }

  async runningSessions(hostedPids: Iterable<number>): Promise<RunningSessionFile[]> {
    const hosted = new Set(hostedPids);
    const names = await readdir(this.#sessionsDir).catch(() => [] as string[]);
    const files = await Promise.all(
      names.map(async (name) => {
        const pid = SESSION_FILE_PATTERN.exec(name)?.[1];
        if (pid === undefined || hosted.has(Number(pid))) return undefined;
        const alive = await stat(path.join(this.#procDir, pid)).then(
          () => true,
          () => false,
        );
        if (!alive) return undefined;
        return readFile(path.join(this.#sessionsDir, name), { encoding: 'utf8', flag: 'r' })
          .then((text) => parseSessionFile(Number(pid), text))
          .catch(() => undefined);
      }),
    );
    return files.filter((file): file is RunningSessionFile => file !== undefined);
  }
}
