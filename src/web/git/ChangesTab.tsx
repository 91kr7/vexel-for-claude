import { useState } from 'react';
import { Header, ListBox, ListBoxItem, ListBoxSection, type Selection } from 'react-aria-components';
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

const entryKey = ({ group, path }: Pick<ChangeEntry, 'group' | 'path'>) => `${group}:${path}`;

export function ChangesTab({ root, changes }: { root: string; changes: ChangeEntry[] }) {
  const [selectedKey, setSelectedKey] = useState<Pick<ChangeEntry, 'group' | 'path'>>();
  // After a refresh the selection follows the same group and path, else it closes.
  const selected = selectedKey && changes.find((entry) => entry.group === selectedKey.group && entry.path === selectedKey.path);
  if (selectedKey !== undefined && selected === undefined) setSelectedKey(undefined);
  const diff = useFileDiff(root, selected);

  return (
    <div className="changes-tab">
      <ListBox
        className="changes-list"
        aria-label="Changed files"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={selected === undefined ? [] : [entryKey(selected)]}
        onSelectionChange={(keys: Selection) => {
          const entry = keys === 'all' ? undefined : changes.find((candidate) => keys.has(entryKey(candidate)));
          if (entry !== undefined) setSelectedKey({ group: entry.group, path: entry.path });
        }}
      >
        {GROUPS.map(({ group, title }) => {
          const entries = changes.filter((entry) => entry.group === group);
          if (entries.length === 0) return null;
          return (
            <ListBoxSection key={group} id={group} className="changes-group" aria-label={title}>
              <Header className="changes-group-title">{title}</Header>
              {entries.map((entry) => (
                <ListBoxItem key={entryKey(entry)} id={entryKey(entry)} textValue={pathText(entry)} className="changes-item">
                  <span className="changes-file-path" title={pathText(entry)}>
                    {pathText(entry)}
                  </span>
                  <span className={`changes-kind changes-kind-${entry.kind}`}>{KIND_LABEL[entry.kind]}</span>
                </ListBoxItem>
              ))}
            </ListBoxSection>
          );
        })}
      </ListBox>
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
