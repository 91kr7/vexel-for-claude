import { Fragment } from 'react';
import { Decoration, Diff, Hunk, type ChangeData, type HunkData } from 'react-diff-view';
import 'react-diff-view/style/index.css';
import type { DiffLine, FileDiff } from './diff-store';

const MARKER: Record<DiffLine['kind'], string> = { added: '+', removed: '-', context: ' ', hunk: '' };

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

// Adapts the lines of parseDiff to the hunks of react-diff-view; the marker stays in the shown text.
function toHunks(lines: DiffLine[]): HunkData[] {
  const hunks: HunkData[] = [];
  let hunk: HunkData | undefined;
  let oldLine = 1;
  let newLine = 1;
  for (const line of lines) {
    if (line.kind === 'hunk' || hunk === undefined) {
      const match = line.kind === 'hunk' ? HUNK_HEADER.exec(line.text) : null;
      oldLine = match ? Number(match[1]) : 1;
      newLine = match ? Number(match[2]) : 1;
      hunk = { content: line.kind === 'hunk' ? line.text : '', oldStart: oldLine, newStart: newLine, oldLines: 0, newLines: 0, changes: [] };
      hunks.push(hunk);
      if (line.kind === 'hunk') continue;
    }
    const content = MARKER[line.kind] + line.text;
    let change: ChangeData;
    if (line.kind === 'added') change = { type: 'insert', isInsert: true, content, lineNumber: newLine++ };
    else if (line.kind === 'removed') change = { type: 'delete', isDelete: true, content, lineNumber: oldLine++ };
    else change = { type: 'normal', isNormal: true, content, oldLineNumber: oldLine++, newLineNumber: newLine++ };
    hunk.changes.push(change);
    if (change.type !== 'insert') hunk.oldLines++;
    if (change.type !== 'delete') hunk.newLines++;
  }
  return hunks;
}

export function DiffView({ diff }: { diff: FileDiff }) {
  if (diff.binary) return <p className="diff-note">Binary file, no diff shown</p>;
  return (
    <div className="diff-view">
      <Diff viewType="unified" diffType="modify" gutterType="none" hunks={toHunks(diff.lines)}>
        {(hunks) =>
          hunks.map((hunk, index) => (
            <Fragment key={index}>
              {hunk.content !== '' && <Decoration className="diff-hunk-header">{hunk.content}</Decoration>}
              <Hunk hunk={hunk} />
            </Fragment>
          ))
        }
      </Diff>
      {diff.cut && <p className="diff-note">Diff cut at 5,000 lines</p>}
    </div>
  );
}
