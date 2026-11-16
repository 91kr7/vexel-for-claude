export interface Commit {
  hash: string;
  shortHash: string;
  /** Full hashes of the parents, first parent first; empty for a root commit. */
  parents: string[];
  /** Full message, without its trailing newlines. */
  message: string;
  author: string;
  /** Author date, ISO 8601 with offset. */
  date: string;
  /** Committer date, ISO 8601 with offset: the date `--date-order` sorts by. */
  committerDate: string;
}

/** The `git log` format that parseLog reads, for `git log -z`. */
export const LOG_FORMAT = '--format=%H%x00%h%x00%P%x00%B%x00%an%x00%aI%x00%cI';

const FIELD_COUNT = 7;

export function parseLog(output: string): Commit[] {
  const fields = output.split('\0');
  const commits: Commit[] = [];
  for (let index = 0; index + FIELD_COUNT <= fields.length; index += FIELD_COUNT) {
    const [hash = '', shortHash = '', parents = '', message = '', author = '', date = '', committerDate = ''] = fields.slice(index, index + FIELD_COUNT);
    commits.push({
      hash,
      shortHash,
      parents: parents.split(' ').filter(Boolean),
      message: message.replace(/\n+$/, ''),
      author,
      date,
      committerDate,
    });
  }
  return commits;
}
