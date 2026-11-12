import { useState } from 'react';
import { Dialog } from '../dialogs/Dialog';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { Avatar, folderNameOf } from '../sessions/Avatar';
import type { Project } from './project-list-store';

const NAME_MAX_LENGTH = 200;
const START_FAILED = 'Could not start the session.';

interface SessionNameDialogProps {
  project: Project;
  onStarted: (sessionId: string) => void;
  onCancel: () => void;
}

function sessionNameOf(text: string): string {
  return Array.from(text.trim()).slice(0, NAME_MAX_LENGTH).join('');
}

export function SessionNameDialog({ project, onStarted, onCancel }: SessionNameDialogProps) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const start = async () => {
    setFailed(false);
    setBusy(true);
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: project.folder, name: sessionNameOf(name) }),
      });
      if (response.ok) {
        const { id } = (await response.json()) as { id: string };
        onStarted(id);
        return;
      }
      setFailed(true);
    } catch {
      setFailed(true);
    }
    setBusy(false);
  };

  return (
    <Dialog
      title="New session"
      className="session-name-dialog"
      primaryLabel="Start Session"
      onPrimary={() => void start()}
      primaryBusy={busy}
      onCancel={onCancel}
    >
      <div className="session-name-project">
        <Avatar folder={project.folder} />
        <span className="project-row-text">
          <span className="project-row-name">{folderNameOf(project.folder)}</span>
          <span className="project-row-path" title={project.folder}>
            {project.folder}
          </span>
        </span>
      </div>
      <label className="field">
        <span className="field-label">Session name</span>
        <input
          className="field-input"
          type="text"
          autoComplete="off"
          maxLength={NAME_MAX_LENGTH}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
        <small className="field-hint">Leave it empty to use the default name. Enter starts, Esc cancels.</small>
      </label>
      {failed && <ErrorMessage>{START_FAILED}</ErrorMessage>}
    </Dialog>
  );
}
