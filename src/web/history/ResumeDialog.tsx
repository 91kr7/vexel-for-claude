import { useEffect, useId, useRef, useState } from 'react';
import { Dialog } from '../dialogs/Dialog';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { AreaState } from '../feedback/AreaState';
import { HistoryIcon, SearchIcon, TerminalIcon, XIcon } from '../icons/Icons';
import { Avatar } from '../sessions/Avatar';
import { FavoriteIndicator } from '../sessions/FavoriteIndicator';
import { RunningElsewhereWarning } from './RunningElsewhereWarning';

interface PastSessionEntry {
  id: string;
  label: string;
  lastActivity: string;
  runningElsewhere: boolean;
  favorite?: true;
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
  session_not_found: 'The session no longer exists.',
  folder_not_found: 'The project folder does not exist.',
};
const LOAD_FAILED = 'Could not load the past sessions.';
const RESUME_FAILED = 'Could not resume the session.';

async function errorMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return ERROR_MESSAGES[body?.error ?? ''] ?? RESUME_FAILED;
}

function describedBy(id: string, session: PastSessionEntry): string {
  const parts = [`${id}-time`];
  if (session.runningElsewhere) parts.push(`${id}-running`);
  if (session.favorite === true) parts.push(`${id}-favorite`);
  return parts.join(' ');
}

function formatDate(iso: string): string {
  const time = new Date(iso);
  return `${time.toLocaleDateString('en-GB')} ${time.toLocaleTimeString('en-GB')}`;
}

function filterGroups(groups: PastSessionGroup[], query: string): PastSessionGroup[] {
  const text = query.toLowerCase();
  if (text === '') return groups;
  return groups.flatMap((group) => {
    if (group.folder.toLowerCase().includes(text)) return [group];
    const sessions = group.sessions.filter((session) => session.label.toLowerCase().includes(text));
    return sessions.length > 0 ? [{ ...group, sessions }] : [];
  });
}

export function ResumeDialog({ onResumed, onCancel }: ResumeDialogProps) {
  const [groups, setGroups] = useState<PastSessionGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [warningFor, setWarningFor] = useState<string | null>(null);
  const [selected, setSelected] = useState<PastSessionEntry | null>(null);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const rowId = useId();
  const visibleGroups = groups === null ? null : filterGroups(groups, query);

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

  const search = (text: string) => {
    setQuery(text);
    const stillVisible = filterGroups(groups ?? [], text).some((group) => group.sessions.some((session) => session.id === selected?.id));
    if (!stillVisible) setSelected(null);
  };

  const choose = (session: PastSessionEntry) => {
    if (session.runningElsewhere) setWarningFor(session.id);
    else void resume(session.id);
  };

  return (
    <>
      <Dialog
        title="Resume Session"
        className="resume-dialog"
        primaryLabel="Resume"
        onPrimary={() => {
          if (selected !== null) choose(selected);
        }}
        primaryDisabled={selected === null}
        primaryBusy={busy}
        onCancel={onCancel}
      >
        <div className="search-field">
          <SearchIcon />
          <input
            ref={searchRef}
            className="field-input search-field-input"
            type="text"
            value={query}
            placeholder="Search by label or folder"
            aria-label="Search Past Sessions"
            onChange={(event) => search(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.preventDefault();
            }}
            autoFocus
          />
          {query !== '' && (
            <button
              type="button"
              className="search-field-clear"
              aria-label="Clear Search"
              title="Clear Search"
              onClick={() => {
                search('');
                searchRef.current?.focus();
              }}
            >
              <XIcon />
            </button>
          )}
        </div>
        <div
          className="dialog-scroll"
          role={visibleGroups?.length ? 'radiogroup' : undefined}
          aria-label={visibleGroups?.length ? 'Past Sessions' : undefined}
        >
          {groups === null && error === null && <AreaState kind="loading" size="compact" title="Loading…" />}
          {groups?.length === 0 && <AreaState kind="empty" size="compact" icon={<HistoryIcon />} title="No sessions to resume." />}
          {groups?.length !== 0 && visibleGroups?.length === 0 && (
            <AreaState kind="empty" size="compact" icon={<HistoryIcon />} title={`No sessions match "${query}".`} />
          )}
          {visibleGroups?.map((group) => (
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
                        <span className="past-session-heading">
                          <span id={`${id}-label`} className="dialog-row-title">
                            {session.label}
                          </span>
                          {session.favorite === true && (
                            <span id={`${id}-favorite`} className="past-session-favorite">
                              <FavoriteIndicator />
                            </span>
                          )}
                        </span>
                        <time id={`${id}-time`} className="dialog-row-detail" dateTime={session.lastActivity}>
                          {formatDate(session.lastActivity)}
                        </time>
                        {session.runningElsewhere && (
                          <span id={`${id}-running`} className="status-pill state-needs_input past-session-running">
                            <TerminalIcon />
                            Running in a terminal
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
                        aria-describedby={describedBy(id, session)}
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
