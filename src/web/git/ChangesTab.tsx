import { useState } from 'react';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { ProgressIndicator } from '../feedback/ProgressIndicator';
import type { ChangeEntry, ChangeGroup, ChangeKind } from './changes-store';
import { DiffView } from './DiffView';
import { useFileDiff } from './diff-store';

const GROUPS: { group: ChangeGroup; title: string }[] = [
  { group: 'staged', title: 'Staged' },
  { group: 'unstaged', title: 'Unstaged' },
];

export const KIND_LABEL: Record<ChangeKind, string> = {
  added: 'Added',
  modified: 'Modified',
  deleted: 'Deleted',
  renamed: 'Renamed',
  untracked: 'Untracked',
};

const pathText = ({ path, oldPath }: ChangeEntry) => (oldPath === undefined ? path : `${oldPath} → ${path}`);

export function ChangesTab({ root, changes }: { root: string; changes: ChangeEntry[] }) {
  const [selected, setSelected] = useState<ChangeEntry>();
  const diff = useFileDiff(root, selected);

  return (
    <div className="changes-tab">
      <div className="changes-list">
        {GROUPS.map(({ group, title }) => {
          const entries = changes.filter((entry) => entry.group === group);
          if (entries.length === 0) return null;
          return (
            <section key={group} className="changes-group" aria-label={title}>
              <h4 className="changes-group-title">{title}</h4>
              <ul>
                {entries.map((entry) => (
                  <li key={entry.path}>
                    <button
                      type="button"
                      className={entry === selected ? 'changes-file selected' : 'changes-file'}
                      aria-pressed={entry === selected}
                      onClick={() => setSelected(entry)}
                    >
                      <span className="changes-file-path" title={pathText(entry)}>
                        {pathText(entry)}
                      </span>
                      <span className={`changes-kind changes-kind-${entry.kind}`}>{KIND_LABEL[entry.kind]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {diff.status !== 'idle' && (
        <div className="changes-diff">
          {diff.status === 'loading' && <ProgressIndicator />}
          {diff.status === 'error' && <ErrorMessage>{diff.message}</ErrorMessage>}
          {diff.status === 'loaded' && <DiffView diff={diff.diff} />}
        </div>
      )}
    </div>
  );
}
