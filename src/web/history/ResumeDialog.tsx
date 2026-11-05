import { useEffect, useId, useState } from 'react';
import { Dialog } from '../dialogs/Dialog';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { AreaState } from '../feedback/AreaState';
import { HistoryIcon, TerminalIcon } from '../icons/Icons';
import { Avatar } from '../sessions/Avatar';
import { RunningElsewhereWarning } from './RunningElsewhereWarning';

interface PastSessionEntry {
  id: string;
  label: string;
  lastActivity: string;
  runningElsewhere: boolean;
}

interface PastSessionGroup {
  folder: string;
  sessions: PastSessionEntry[];
}

interface ResumeDialogProps {
  onResumed: (sessionId: string) => void;
  onCancel: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  session_not_found: 'La sessione non esiste più.',
  folder_not_found: 'La cartella del progetto non esiste.',
};
const LOAD_FAILED = 'Caricamento delle sessioni passate non riuscito.';
const RESUME_FAILED = 'Ripresa della sessione non riuscita.';

async function errorMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return ERROR_MESSAGES[body?.error ?? ''] ?? RESUME_FAILED;
}

function formatDate(iso: string): string {
  const time = new Date(iso);
  return `${time.toLocaleDateString('it-IT')} ${time.toLocaleTimeString('it-IT')}`;
}

export function ResumeDialog({ onResumed, onCancel }: ResumeDialogProps) {
  const [groups, setGroups] = useState<PastSessionGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [warningFor, setWarningFor] = useState<string | null>(null);
  const [selected, setSelected] = useState<PastSessionEntry | null>(null);
  const rowId = useId();

  useEffect(() => {
    let active = true;
    fetch('/api/past-sessions')
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const loaded = (await response.json()) as PastSessionGroup[];
        if (active) setGroups(loaded);
      })
      .catch(() => {
        if (active) setError(LOAD_FAILED);
      });
    return () => {
      active = false;
    };
  }, []);

  const resume = async (pastSessionId: string) => {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(`/api/past-sessions/${encodeURIComponent(pastSessionId)}/resume`, { method: 'POST' });
      if (!response.ok) {
        setError(await errorMessage(response));
        return;
      }
      const { id } = (await response.json()) as { id: string };
      onResumed(id);
    } catch {
      setError(RESUME_FAILED);
    } finally {
      setBusy(false);
    }
  };

  const choose = (session: PastSessionEntry) => {
    if (session.runningElsewhere) setWarningFor(session.id);
    else void resume(session.id);
  };

  return (
    <>
      <Dialog
        title="Riprendi sessione"
        className="resume-dialog"
        primaryLabel="Riprendi"
        onPrimary={() => {
          if (selected !== null) choose(selected);
        }}
        primaryDisabled={selected === null}
        primaryBusy={busy}
        onCancel={onCancel}
      >
        <div
          className="dialog-scroll"
          role={groups?.length ? 'radiogroup' : undefined}
          aria-label={groups?.length ? 'Sessioni passate' : undefined}
        >
          {groups === null && error === null && <AreaState kind="loading" size="compact" title="Caricamento…" />}
          {groups?.length === 0 && <AreaState kind="empty" size="compact" icon={<HistoryIcon />} title="Nessuna sessione da riprendere." />}
          {groups?.map((group) => (
            <section key={group.folder} className="past-session-group" aria-label={group.folder}>
              <h3 className="section-label section-label-path dialog-section-heading">{group.folder}</h3>
              <div className="dialog-rows">
                {group.sessions.map((session) => {
                  const checked = selected?.id === session.id;
                  const id = `${rowId}-${session.id}`;
                  return (
                    <label key={session.id} className={checked ? 'dialog-row dialog-row-checked' : 'dialog-row'}>
                      <Avatar folder={group.folder} />
                      <span className="dialog-row-text">
                        <span id={`${id}-label`} className="dialog-row-title">
                          {session.label}
                        </span>
                        <time id={`${id}-time`} className="dialog-row-detail" dateTime={session.lastActivity}>
                          {formatDate(session.lastActivity)}
                        </time>
                        {session.runningElsewhere && (
                          <span id={`${id}-running`} className="status-pill state-needs_input past-session-running">
                            <TerminalIcon />
                            In esecuzione in un terminale
                          </span>
                        )}
                      </span>
                      <input
                        type="radio"
                        className="dialog-radio"
                        name={`${rowId}-session`}
                        checked={checked}
                        disabled={busy}
                        aria-labelledby={`${id}-label`}
                        aria-describedby={session.runningElsewhere ? `${id}-time ${id}-running` : `${id}-time`}
                        onChange={() => setSelected(session)}
                      />
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        {error && <ErrorMessage>{error}</ErrorMessage>}
      </Dialog>
      {warningFor !== null && (
        <RunningElsewhereWarning
          onConfirm={() => {
            const pastSessionId = warningFor;
            setWarningFor(null);
            void resume(pastSessionId);
          }}
          onCancel={() => setWarningFor(null)}
        />
      )}
    </>
  );
}
