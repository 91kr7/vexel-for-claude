export const DIFF_MAX_LINES = 5_000;

export type DiffLineKind = 'added' | 'removed' | 'context' | 'hunk';

export interface DiffLine {
  kind: DiffLineKind;
  /** The line without its diff marker; the whole header for a hunk. */
  text: string;
}

export interface FileDiff {
  binary: boolean;
  cut: boolean;
  lines: DiffLine[];
}

const BODY_KIND: Record<string, DiffLineKind> = { '+': 'added', '-': 'removed', ' ': 'context' };

function bodyLine(line: string): DiffLine | undefined {
  if (line.startsWith('@@')) return { kind: 'hunk', text: line };
  if (line === '') return { kind: 'context', text: '' };
  const kind = BODY_KIND[line.charAt(0)];
  return kind === undefined ? undefined : { kind, text: line.slice(1) };
}

/** `truncated` → the output stops before its end: its last partial line is dropped and the diff is cut. */
export function parseDiff(output: string, truncated = false): FileDiff {
  const lines: DiffLine[] = [];
  let inHeader = true;
  const rows = output.split('\n');
  const lastRow = rows.pop();
  if (lastRow !== undefined && lastRow !== '' && !truncated) rows.push(lastRow);
  for (const row of rows) {
    if (row.startsWith('diff ')) {
      inHeader = true;
      continue;
    }
    if (inHeader) {
      if (row.startsWith('Binary files ') || row === 'GIT binary patch') return { binary: true, cut: false, lines: [] };
      if (!row.startsWith('@@')) continue;
      inHeader = false;
    }
    const line = bodyLine(row);
    if (line === undefined) continue;
    if (lines.length === DIFF_MAX_LINES) return { binary: false, cut: true, lines };
    lines.push(line);
  }
  return { binary: false, cut: truncated, lines };
}
