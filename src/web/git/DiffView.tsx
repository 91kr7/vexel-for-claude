import type { DiffLine, FileDiff } from './diff-store';

const MARKER: Record<DiffLine['kind'], string> = { added: '+', removed: '-', context: ' ', hunk: '' };

export function DiffView({ diff }: { diff: FileDiff }) {
  if (diff.binary) return <p className="diff-note">Binary file, no diff shown</p>;
  return (
    <div className="diff-view">
      <div className="diff-lines">
        {diff.lines.map((line, index) => (
          <div key={index} className={`diff-line diff-line-${line.kind}`}>
            {MARKER[line.kind]}
            {line.text}
          </div>
        ))}
      </div>
      {diff.cut && <p className="diff-note">Diff cut at 5,000 lines</p>}
    </div>
  );
}
