import { useState, type ReactNode } from 'react';
import { Header, ListBox, ListBoxItem, ListBoxSection, type Selection } from 'react-aria-components';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { ProgressIndicator } from '../feedback/ProgressIndicator';
import type { ChangeEntry, ChangeGroup, ChangeKind, ChangesState } from './changes-store';
import { DiffView } from './DiffView';
import { useFileDiff } from './diff-store';
import { repositoryColor } from './repository-colors';
import type { CoveredRepository } from './repository-lookup-store';

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

const LOADING: ChangesState = { status: 'loading' };

export const fileItemClassName = ({ isSelected }: { isSelected: boolean }) =>
  isSelected ? 'changes-item list-row list-active' : 'changes-item list-row';

type SelectionKey = { root: string; group: ChangeGroup; path: string };

function FileList({
  label,
  changes,
  selected,
  onSelect,
  className,
}: {
  label: string;
  changes: ChangeEntry[];
  selected: ChangeEntry | undefined;
  onSelect: (entry: ChangeEntry) => void;
  className: string;
}) {
  return (
    <ListBox
      className={className}
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={selected === undefined ? [] : [entryKey(selected)]}
      onSelectionChange={(keys: Selection) => {
        const entry = keys === 'all' ? undefined : changes.find((candidate) => keys.has(entryKey(candidate)));
        if (entry !== undefined) onSelect(entry);
      }}
    >
      {GROUPS.map(({ group, title }) => {
        const entries = changes.filter((entry) => entry.group === group);
        if (entries.length === 0) return null;
        return (
          <ListBoxSection key={group} id={group} className="changes-group" aria-label={title}>
            <Header className="changes-group-title">{title}</Header>
            {entries.map((entry) => (
              <ListBoxItem key={entryKey(entry)} id={entryKey(entry)} textValue={pathText(entry)} className={fileItemClassName}>
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
  );
}

function GroupBody({ state, children }: { state: ChangesState; children: (changes: ChangeEntry[]) => ReactNode }) {
  if (state.status === 'loading') return <ProgressIndicator className="git-explorer-message" />;
  if (state.status === 'error') return <ErrorMessage className="git-explorer-error">{state.message}</ErrorMessage>;
  if (state.changes.length === 0) return <p className="git-explorer-message">No uncommitted changes</p>;
  return children(state.changes);
}

interface ChangesTabProps {
  repositories: readonly CoveredRepository[];
  /** The state of each repository, in the order of `repositories`. */
  changes: readonly ChangesState[];
  /** The colour of each repository; default: repositoryColor of its position. */
  colors?: readonly string[];
  /** Groups by repository; default: more than one repository. */
  several?: boolean;
}

export function ChangesTab({ repositories, changes, colors, several = repositories.length > 1 }: ChangesTabProps) {
  const [selectedKey, setSelectedKey] = useState<SelectionKey>();
  // After a refresh the selection follows the same repository, group and path, else it closes.
  const selectedIndex = selectedKey === undefined ? -1 : repositories.findIndex((repository) => repository.root === selectedKey.root);
  const selectedState = changes[selectedIndex];
  const selected =
    selectedKey !== undefined && selectedState?.status === 'loaded'
      ? selectedState.changes.find((entry) => entry.group === selectedKey.group && entry.path === selectedKey.path)
      : undefined;
  if (selectedKey !== undefined && selected === undefined && selectedState?.status !== 'loading') setSelectedKey(undefined);
  const diff = useFileDiff(selectedKey?.root ?? '', selected);
  const select = (root: string) => (entry: ChangeEntry) => setSelectedKey({ root, group: entry.group, path: entry.path });
  const selectedIn = (root: string) => (selectedKey?.root === root ? selected : undefined);

  const diffPane = diff.status !== 'idle' && (
    <div className="changes-diff">
      {diff.status === 'loading' && <ProgressIndicator />}
      {diff.status === 'error' && <ErrorMessage>{diff.message}</ErrorMessage>}
      {diff.status === 'loaded' && <DiffView diff={diff.diff} />}
    </div>
  );

  const single = !several && repositories.length === 1 ? repositories[0] : undefined;
  if (single !== undefined) {
    return (
      <GroupBody state={changes[0] ?? LOADING}>
        {(entries) => (
          <div className="changes-tab">
            <FileList className="changes-list" label="Changed files" changes={entries} selected={selectedIn(single.root)} onSelect={select(single.root)} />
            {diffPane}
          </div>
        )}
      </GroupBody>
    );
  }

  return (
    <div className="changes-tab">
      <div className="changes-list">
        {repositories.map((repository, index) => (
          <section key={repository.root} className="changes-repository" aria-label={repository.name}>
            <h4 className="changes-repository-title" title={repository.root}>
              <span className="git-repository-mark" style={{ backgroundColor: colors?.[index] ?? repositoryColor(index) }} aria-hidden="true" />
              {repository.name}
            </h4>
            <GroupBody state={changes[index] ?? LOADING}>
              {(entries) => (
                <FileList
                  className="changes-repository-files"
                  label={`Changed files of ${repository.name}`}
                  changes={entries}
                  selected={selectedIn(repository.root)}
                  onSelect={select(repository.root)}
                />
              )}
            </GroupBody>
          </section>
        ))}
      </div>
      {diffPane}
    </div>
  );
}
