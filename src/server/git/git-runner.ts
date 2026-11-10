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

// A missing working folder and a missing git binary both fail the spawn with ENOENT.
function errorOf(error: ExecFileException, stderr: string, folder: string): GitError {
  if (error.code === 'ENOENT') {
    return existsSync(folder) ? new GitError('not_installed', 'git is not installed.') : new GitError('folder_not_found', 'The folder does not exist.');
  }
  if (error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') return new GitError('output_too_large', 'The git output is larger than 5 MB.');
  if (error.killed) return new GitError('timeout', 'git did not answer within 10 s.');
  const message = stderr.trim() || error.message;
  return new GitError('failed', message, typeof error.code === 'number' ? error.code : undefined);
}

export class GitRunner {
  constructor(private readonly gitPath = 'git') {}

  run(folder: string, args: readonly string[]): Promise<string> {
    if (!isReadCommand(args)) return Promise.reject(new GitCommandRejected(args));
    return new Promise((resolve, reject) => {
      execFile(
        this.gitPath,
        ['--no-optional-locks', ...args],
        { cwd: folder, env: gitEnvironment(), timeout: GIT_TIMEOUT_MS, maxBuffer: GIT_MAX_OUTPUT_BYTES, encoding: 'utf8' },
        (error, stdout, stderr) => {
          if (error) reject(errorOf(error, stderr, folder));
          else resolve(stdout);
        },
      );
    });
  }
}
