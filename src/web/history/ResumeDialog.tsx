import { useEffect, useState } from 'react';
import { Dialog } from '../dialogs/Dialog';
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
const GENERIC_ERROR = 'Operazione non riuscita.';

async function errorMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return ERROR_MESSAGES[body?.error ?? ''] ?? GENERIC_ERROR;
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

  useEffect(() => {
    let active = true;
    fetch('/api/past-sessions')
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const loaded = (await response.json()) as PastSessionGroup[];
        if (active) setGroups(loaded);
      })
      .catch(() => {
        if (active) setError(GENERIC_ERROR);
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
      setError(GENERIC_ERROR);
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
        primaryDisabled={selected === null || busy}
        onCancel={onCancel}
      >
        <div className="past-session-groups">
          {groups === null && error === null && <p>Caricamento…</p>}
          {groups?.length === 0 && <p>Nessuna sessione da riprendere.</p>}
          {groups?.map((group) => (
            <section key={group.folder} className="past-session-group" aria-label={group.folder}>
              <h3>{group.folder}</h3>
              <ul>
                {group.sessions.map((session) => (
                  <li key={session.id}>
                    <button
                      type="button"
                      className="past-session"
                      aria-pressed={selected?.id === session.id}
                      disabled={busy}
                      onClick={() => setSelected(session)}
                    >
                      <span className="past-session-label">{session.label}</span>
                      <span className="past-session-meta">
                        <time dateTime={session.lastActivity}>{formatDate(session.lastActivity)}</time>
                        {session.runningElsewhere && (
                          <span className="past-session-running">In esecuzione in un terminale</span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
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
