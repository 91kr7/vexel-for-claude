export type ChangeGroup = 'staged' | 'unstaged';

export type ChangeKind = 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked';

export interface ChangeEntry {
  group: ChangeGroup;
  kind: ChangeKind;
  /** Path from the repository root. */
  path: string;
  /** Path before the rename, only for `renamed`. */
  oldPath?: string;
}

const KIND_OF_CODE: Record<string, ChangeKind> = {
  A: 'added',
  C: 'added',
  M: 'modified',
  T: 'modified',
  D: 'deleted',
  R: 'renamed',
};

// Field count before the path, per record type of `git status --porcelain=v2`.
const FIELDS_BEFORE_PATH: Record<string, number> = { '1': 8, '2': 9, u: 10 };

function pathAfterFields(record: string, fields: number): string {
  let index = 0;
  for (let found = 0; found < fields; found += 1) index = record.indexOf(' ', index) + 1;
  return record.slice(index);
}

function entryOf(group: ChangeGroup, code: string | undefined, path: string, oldPath: string | undefined): ChangeEntry[] {
  const kind = code === undefined ? undefined : KIND_OF_CODE[code];
  if (kind === undefined) return [];
  return [kind === 'renamed' && oldPath !== undefined ? { group, kind, path, oldPath } : { group, kind, path }];
}

export function parseStatus(output: string): ChangeEntry[] {
  const records = output.split('\0');
  const entries: ChangeEntry[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index] ?? '';
    const type = record.charAt(0);
    if (type === '?') {
      entries.push({ group: 'unstaged', kind: 'untracked', path: record.slice(2) });
      continue;
    }
    const fields = FIELDS_BEFORE_PATH[type];
    if (fields === undefined) continue;
    const path = pathAfterFields(record, fields);
    if (type === 'u') {
      entries.push({ group: 'unstaged', kind: 'modified', path });
      continue;
    }
    const oldPath = type === '2' ? records[(index += 1)] : undefined;
    entries.push(...entryOf('staged', record.charAt(2), path, oldPath), ...entryOf('unstaged', record.charAt(3), path, oldPath));
  }
  return entries;
}
