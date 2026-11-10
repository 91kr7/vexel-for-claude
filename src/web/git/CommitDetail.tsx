import { useState } from 'react';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { ProgressIndicator } from '../feedback/ProgressIndicator';
import { KIND_LABEL } from './ChangesTab';
import { formatCommitDate } from './commit-format';
import { useCommitFiles, type CommitFile } from './commit-files-store';
import { DiffView } from './DiffView';
import { useCommitFileDiff } from './diff-store';
import type { Commit } from './history-store';

const pathText = ({ path, oldPath }: CommitFile) => (oldPath === undefined ? path : `${oldPath} → ${path}`);

function FileList({ files, selected, onSelect }: { files: CommitFile[]; selected?: CommitFile; onSelect: (file: CommitFile) => void }) {
  if (files.length === 0) return <p className="git-explorer-message">No files changed</p>;
  return (
    <ul className="commit-files" aria-label="Changed files">
      {files.map((file) => (
        <li key={file.path}>
          <button
            type="button"
            className={file === selected ? 'changes-file selected' : 'changes-file'}
            aria-pressed={file === selected}
            onClick={() => onSelect(file)}
          >
            <span className="changes-file-path" title={pathText(file)}>
              {pathText(file)}
            </span>
            {file.binary && <span className="changes-kind">Binary</span>}
            <span className={`changes-kind changes-kind-${file.kind}`}>{KIND_LABEL[file.kind]}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function CommitDetail({ root, commit, onBack }: { root: string; commit: Commit; onBack: () => void }) {
  const files = useCommitFiles(root, commit.hash);
  const [selected, setSelected] = useState<CommitFile>();
  const diff = useCommitFileDiff(root, commit.hash, selected);

  return (
    <div className="changes-tab commit-detail">
      <div className="changes-list commit-summary">
        <div className="commit-detail-bar">
          <button type="button" className="button-neutral" onClick={onBack}>
            Back
          </button>
          <span className="mono-chip vx-surface-2" title={commit.hash}>
            {commit.shortHash}
          </span>
        </div>
        <p className="commit-message">{commit.message}</p>
        <p className="commit-meta">
          {commit.author} · {formatCommitDate(commit.date)}
        </p>
        {files.status === 'loading' && <ProgressIndicator className="git-explorer-message" />}
        {files.status === 'error' && <ErrorMessage className="git-explorer-error">{files.message}</ErrorMessage>}
        {files.status === 'loaded' && <FileList files={files.files} selected={selected} onSelect={setSelected} />}
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
