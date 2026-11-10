export interface Commit {
  hash: string;
  shortHash: string;
  /** Full message, without its trailing newlines. */
  message: string;
  author: string;
  /** Author date, ISO 8601 with offset. */
  date: string;
}

/** The `git log` format that parseLog reads, for `git log -z`. */
export const LOG_FORMAT = '--format=%H%x00%h%x00%B%x00%an%x00%aI';

const FIELD_COUNT = 5;

export function parseLog(output: string): Commit[] {
  const fields = output.split('\0');
  const commits: Commit[] = [];
  for (let index = 0; index + FIELD_COUNT <= fields.length; index += FIELD_COUNT) {
    const [hash = '', shortHash = '', message = '', author = '', date = ''] = fields.slice(index, index + FIELD_COUNT);
    commits.push({ hash, shortHash, message: message.replace(/\n+$/, ''), author, date });
  }
  return commits;
}
