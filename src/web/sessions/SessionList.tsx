import { type DragEvent, useEffect, useId, useState } from 'react';
import { AreaState } from '../feedback/AreaState';
import { folderNameOf } from './Avatar';
import { EndedEntryActions } from './EndedEntryActions';
import type { LoadStatus, RunningTool, SessionSummary } from './live-session-store';
import { ProgressBar } from './ProgressBar';
import { RelativeTime } from './RelativeTime';
import { groupSessions, type SessionGroupId, type SessionOrder } from './session-order';
import { StateBadge } from './StateBadge';

function entryClass(session: SessionSummary): string {
  const classes = ['session-entry'];
  if (session.state === 'needs_input') classes.push('needs-input');
  if (session.state === 'ended') classes.push('ended');
  if (session.external) classes.push('external');
  return classes.join(' ');
}

function PermissionText({ session }: { session: SessionSummary }) {
  if (session.waitingTool === undefined) return <>{session.label}</>;
  return (
    <>
      Permission for <b>{session.waitingTool}</b>
    </>
  );
}

function EntryTitle({ session }: { session: SessionSummary }) {
  return (
    <span className="session-entry-title" title={session.folder}>
      {folderNameOf(session.folder)}
    </span>
  );
}

function ToolLine({ tool }: { tool: RunningTool }) {
  const text = tool.argument === undefined ? tool.name : `${tool.name}: ${tool.argument}`;
  const others = tool.others > 0 ? `+${tool.others}` : undefined;
  return (
    <span className="session-entry-line session-entry-tool" title={others ? `${text} ${others}` : text}>
      <span className="session-entry-tool-text">{text}</span>
      {others && <span className="session-entry-tool-others">{others}</span>}
    </span>
  );
}

interface EntryProps {
  session: SessionSummary;
  open: boolean;
  onOpen: (sessionId: string) => void;
}

function EntryRow({ session, open, onOpen }: EntryProps) {
  const externalNeedsInput = session.external === true && session.state === 'needs_input';
  return (
    <button type="button" className={entryClass(session)} aria-current={open ? 'true' : undefined} onClick={() => onOpen(session.id)}>
      <span className="session-entry-line">
        <StateBadge state={session.state} variant="dot" />
        <EntryTitle session={session} />
        {externalNeedsInput && <span className="mono-chip vx-surface-2 session-external">External</span>}
        <StateBadge state={session.state} />
      </span>
      <span className="session-entry-line session-entry-detail">
        <span className={externalNeedsInput ? 'session-entry-label session-entry-permission' : 'session-entry-label'} title={session.label}>
          {externalNeedsInput ? <PermissionText session={session} /> : session.label}
        </span>
        <RelativeTime className="session-entry-time" iso={session.lastActivity} />
      </span>
      {session.state === 'working' && session.runningTool && <ToolLine tool={session.runningTool} />}
      {session.state === 'working' && !session.external && <ProgressBar />}
    </button>
  );
}

function NeedsInputCard({ session, open, onOpen }: EntryProps) {
  const lineId = useId();
  return (
    <div className={open ? 'session-card vx-surface-2 open' : 'session-card vx-surface-2'}>
      <button
        type="button"
        className={entryClass(session)}
        aria-current={open ? 'true' : undefined}
        aria-describedby={lineId}
        onClick={() => onOpen(session.id)}
      >
        <span className="session-entry-line">
          <span className="perm-tag">Needs Input</span>
          <EntryTitle session={session} />
        </span>
        <span className="session-entry-label" title={session.label}>
          {session.label}
        </span>
      </button>
      <span className="session-card-line" id={lineId}>
        <PermissionText session={session} /> · <RelativeTime iso={session.lastActivity} />
      </span>
      <div className="session-card-actions">
        <button type="button" className="button-primary session-card-reply" onClick={() => onOpen(session.id)}>
          Reply
        </button>
      </div>
    </div>
  );
}

interface SessionListProps {
  sessions: readonly SessionSummary[];
  openSessionId: string | null;
  onOpen: (sessionId: string) => void;
  status?: LoadStatus;
  order?: SessionOrder;
  onReorder?: (sessionId: string, groupId: SessionGroupId, index: number) => void;
  onResumed?: (sessionId: string) => void;
}

interface DragState {
  sessionId: string;
  groupId: SessionGroupId;
  slot: number | null;
}

export function SessionList({ sessions, openSessionId, onOpen, status = 'ready', order, onReorder, onResumed }: SessionListProps) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const groups = groupSessions(sessions, order);
  const draggedGroup = drag && groups.find((group) => group.id === drag.groupId && group.sessions.some((session) => session.id === drag.sessionId));

  useEffect(() => {
    if (drag && !draggedGroup) setDrag(null);
  }, [drag, draggedGroup]);

  const endDrag = () => setDrag(null);
  const setSlot = (slot: number | null) => setDrag((current) => (current && current.slot !== slot ? { ...current, slot } : current));
  const dragOverEntry = (event: DragEvent<HTMLLIElement>, entryIndex: number) => {
    const box = event.currentTarget.getBoundingClientRect();
    setSlot(event.clientY < box.top + box.height / 2 ? entryIndex : entryIndex + 1);
  };
  const drop = (event: DragEvent) => {
    if (!drag) return;
    event.preventDefault();
    endDrag();
    if (!draggedGroup || drag.slot === null) return;
    const currentIndex = draggedGroup.sessions.findIndex((session) => session.id === drag.sessionId);
    onReorder?.(drag.sessionId, draggedGroup.id, drag.slot > currentIndex ? drag.slot - 1 : drag.slot);
  };

  return (
    <div
      className="session-list"
      onDragOver={(event) => {
        if (!drag) return;
        event.preventDefault();
        setSlot(null);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSlot(null);
      }}
      onDrop={drop}
      onDragEnd={endDrag}
    >
      {status === 'error' && <AreaState kind="error" size="compact" title="Connection to the server lost. Reload the page." />}
      {status === 'loading' ? (
        <AreaState kind="loading" size="compact" title="Loading…" />
      ) : sessions.length === 0 ? (
        status === 'ready' && <AreaState kind="empty" size="compact" title="No sessions." />
      ) : (
        groups.map((group) => (
          <div
            key={group.id}
            className="session-group"
            onDragOver={(event) => {
              if (draggedGroup !== group) return;
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <h2 className={`section-label session-group-heading session-group-${group.id}`}>{group.title}</h2>
            <ul>
              {group.sessions.map((session, entryIndex) => {
                const Entry = session.state === 'needs_input' && !session.external ? NeedsInputCard : EntryRow;
                const inDraggedGroup = draggedGroup === group;
                const classes = [
                  inDraggedGroup && session.id === drag?.sessionId && 'dragging',
                  inDraggedGroup && drag?.slot === entryIndex && 'drop-before',
                  inDraggedGroup && drag?.slot === entryIndex + 1 && entryIndex === group.sessions.length - 1 && 'drop-after',
                ].filter(Boolean);
                return (
                  <li
                    key={session.id}
                    className={classes.length > 0 ? classes.join(' ') : undefined}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', session.id);
                      setDrag({ sessionId: session.id, groupId: group.id, slot: null });
                    }}
                    onDragOver={inDraggedGroup ? (event) => dragOverEntry(event, entryIndex) : undefined}
                  >
                    <Entry session={session} open={session.id === openSessionId} onOpen={onOpen} />
                    {session.state === 'ended' && !session.external && (
                      <EndedEntryActions sessionId={session.id} resumable={session.resumable === true} onResumed={onResumed} />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
