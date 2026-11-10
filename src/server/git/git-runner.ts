import { execFile, type ExecFileException } from 'node:child_process';
import { existsSync } from 'node:fs';

export const GIT_TIMEOUT_MS = 10_000;
export const GIT_MAX_OUTPUT_BYTES = 5 * 1024 * 1024;

export type GitErrorKind = 'not_installed' | 'folder_not_found' | 'failed' | 'timeout' | 'output_too_large';

export class GitError extends Error {
  constructor(
    readonly kind: GitErrorKind,
    message: string,
    readonly exitCode?: number,
  ) {
    super(message);
    this.name = 'GitError';
  }
}

export class GitCommandRejected extends Error {
  constructor(args: readonly string[]) {
    super(`not a read-only git command: ${args.join(' ')}`);
    this.name = 'GitCommandRejected';
  }
}

const positionalCount = (args: readonly string[]) => args.filter((arg) => !arg.startsWith('-')).length;

// `symbolic-ref` with a second ref writes HEAD, so only its one-ref read form is allowed.
const READ_COMMANDS: Record<string, (args: readonly string[]) => boolean> = {
  'rev-parse': () => true,
  'symbolic-ref': (args) => positionalCount(args) <= 1 && !args.some((arg) => arg === '-d' || arg === '--delete'),
  status: () => true,
  diff: () => true,
  'ls-files': () => true,
};

export function isReadCommand(args: readonly string[]): boolean {
  const [command, ...rest] = args;
  const accepts = command === undefined ? undefined : READ_COMMANDS[command];
  return accepts !== undefined && !rest.some((arg) => arg.startsWith('--output')) && accepts(rest);
}

function gitEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (!name.startsWith('GIT_')) env[name] = value;
  }
  return { ...env, LC_ALL: 'C', GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' };
}

const OUTPUT_TOO_LARGE = 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';

// A missing working folder and a missing git binary both fail the spawn with ENOENT.
function errorOf(error: ExecFileException, stderr: string, folder: string): GitError {
  if (error.code === 'ENOENT') {
    return existsSync(folder) ? new GitError('not_installed', 'git is not installed.') : new GitError('folder_not_found', 'The folder does not exist.');
  }
  if (error.code === OUTPUT_TOO_LARGE) return new GitError('output_too_large', 'The git output is larger than 5 MB.');
  if (error.killed) return new GitError('timeout', 'git did not answer within 10 s.');
  const message = stderr.trim() || error.message;
  return new GitError('failed', message, typeof error.code === 'number' ? error.code : undefined);
}

export interface GitRunOptions {
  /** Exit codes that count as success besides 0, e.g. 1 for `diff --no-index`. */
  successExitCodes?: readonly number[];
}

export interface CappedOutput {
  output: string;
  truncated: boolean;
}

const isSuccessExit = (error: ExecFileException, options: GitRunOptions) =>
  !error.killed && typeof error.code === 'number' && (options.successExitCodes ?? []).includes(error.code);

export class GitRunner {
  constructor(private readonly gitPath = 'git') {}

  async run(folder: string, args: readonly string[], options: GitRunOptions = {}): Promise<string> {
    return (await this.execute(folder, args, options, false)).output;
  }

  /** As `run`, but an output over 5 MB gives its first 5 MB instead of an error. */
  runCapped(folder: string, args: readonly string[], options: GitRunOptions = {}): Promise<CappedOutput> {
    return this.execute(folder, args, options, true);
  }

  private execute(folder: string, args: readonly string[], options: GitRunOptions, capped: boolean): Promise<CappedOutput> {
    if (!isReadCommand(args)) return Promise.reject(new GitCommandRejected(args));
    return new Promise((resolve, reject) => {
      execFile(
        this.gitPath,
        ['--no-optional-locks', ...args],
        { cwd: folder, env: gitEnvironment(), timeout: GIT_TIMEOUT_MS, maxBuffer: GIT_MAX_OUTPUT_BYTES, encoding: 'utf8' },
        (error, stdout, stderr) => {
          if (capped && error?.code === OUTPUT_TOO_LARGE) resolve({ output: stdout, truncated: true });
          else if (error && !isSuccessExit(error, options)) reject(errorOf(error, stderr, folder));
          else resolve({ output: stdout, truncated: false });
        },
      );
    });
  }
}
