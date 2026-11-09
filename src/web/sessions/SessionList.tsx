import { type DragEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { AreaState } from '../feedback/AreaState';
import { PencilIcon } from '../icons/Icons';
import { useSessionCommand } from '../shortcut-channel';
import { folderNameOf } from './Avatar';
import { EndedEntryActions } from './EndedEntryActions';
import type { ContextOccupancy, LoadStatus, RunningTool, SessionSummary, SessionUsage } from './live-session-store';
import { ProgressBar } from './ProgressBar';
import { RelativeTime } from './RelativeTime';
import { type NameEditorEnd, SessionNameEditor } from './SessionNameEditor';
import { groupSessions, type SessionGroupId, type SessionOrder } from './session-order';
import { StateBadge } from './StateBadge';
import { costText, INCOMPLETE_COST_TEXT, percentOf, usageLevelOf } from './usage-format';

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

function ContextPercent({ context }: { context?: ContextOccupancy }) {
  if (!context) return null;
  const percent = percentOf(context);
  return <span className={`session-entry-context usage-${usageLevelOf(percent)}`}>{`${percent}%`}</span>;
}

function EntryCost({ usage }: { usage?: SessionUsage }) {
  if (!usage?.cost) return null;
  return (
    <span className="session-entry-cost">
      {usage.context && <span aria-hidden="true">· </span>}
      <span title="Estimated cost at API list prices">{costText(usage.cost.usd)}</span>
      {usage.cost.incomplete && (
        <span className="usage-incomplete" role="img" aria-label={INCOMPLETE_COST_TEXT} title={INCOMPLETE_COST_TEXT}>
          *
        </span>
      )}
    </span>
  );
}

interface EntryProps {
  session: SessionSummary;
  open: boolean;
  onOpen: (sessionId: string) => void;
  editor?: ReactNode;
}

function EntryRow({ session, open, onOpen, editor }: EntryProps) {
  const externalNeedsInput = session.external === true && session.state === 'needs_input';
  const content = (
    <>
      <span className="session-entry-line">
        <StateBadge state={session.state} variant="dot" />
        <EntryTitle session={session} />
        {externalNeedsInput && <span className="mono-chip vx-surface-2 session-external">External</span>}
        <StateBadge state={session.state} />
      </span>
      <span className="session-entry-line session-entry-detail">
        {editor ?? (
          <span className={externalNeedsInput ? 'session-entry-label session-entry-permission' : 'session-entry-label'} title={session.label}>
            {externalNeedsInput ? <PermissionText session={session} /> : session.label}
          </span>
        )}
        <ContextPercent context={session.usage?.context} />
        <EntryCost usage={session.usage} />
        <RelativeTime className="session-entry-time" iso={session.lastActivity} />
      </span>
      {session.state === 'working' && session.runningTool && <ToolLine tool={session.runningTool} />}
      {session.state === 'working' && !session.external && <ProgressBar />}
    </>
  );
  if (editor) {
    return (
      <div className={entryClass(session)} aria-current={open ? 'true' : undefined}>
        {content}
      </div>
    );
  }
  return (
    <button type="button" className={entryClass(session)} aria-current={open ? 'true' : undefined} onClick={() => onOpen(session.id)}>
      {content}
    </button>
  );
}

function NeedsInputCard({ session, open, onOpen, editor }: EntryProps) {
  const lineId = useId();
  const content = (
    <>
      <span className="session-entry-line">
        <span className="perm-tag">Needs Input</span>
        <EntryTitle session={session} />
      </span>
      <span className="session-entry-line">
        {editor ?? (
          <span className="session-entry-label" title={session.label}>
            {session.label}
          </span>
        )}
        <ContextPercent context={session.usage?.context} />
        <EntryCost usage={session.usage} />
      </span>
    </>
  );
  return (
    <div className={open ? 'session-card vx-surface-2 open' : 'session-card vx-surface-2'}>
      {editor ? (
        <div className={entryClass(session)} aria-current={open ? 'true' : undefined} aria-describedby={lineId}>
          {content}
        </div>
      ) : (
        <button
          type="button"
          className={entryClass(session)}
          aria-current={open ? 'true' : undefined}
          aria-describedby={lineId}
          onClick={() => onOpen(session.id)}
        >
          {content}
        </button>
      )}
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
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const renameButtons = useRef(new Map<string, HTMLButtonElement>());
  const focusAfterRename = useRef<string | null>(null);
  const scrollToEditor = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const groups = groupSessions(sessions, order);
  const draggedGroup = drag && groups.find((group) => group.id === drag.groupId && group.sessions.some((session) => session.id === drag.sessionId));

  useEffect(() => {
    if (drag && !draggedGroup) setDrag(null);
  }, [drag, draggedGroup]);

  useEffect(() => {
    if (renamingId !== null || focusAfterRename.current === null) return;
    renameButtons.current.get(focusAfterRename.current)?.focus();
    focusAfterRename.current = null;
  }, [renamingId]);

  useEffect(() => {
    if (!scrollToEditor.current) return;
    scrollToEditor.current = false;
    listRef.current?.querySelector('.session-name-editor')?.scrollIntoView({ block: 'nearest' });
  }, [renamingId]);

  const openListed = openSessionId !== null && sessions.some((session) => session.id === openSessionId);
  useSessionCommand(
    'rename',
    () => {
      if (openSessionId === null || renamingId === openSessionId) return;
      scrollToEditor.current = true;
      setRenamingId(openSessionId);
    },
    openListed,
  );

  const endRename = (sessionId: string, end: NameEditorEnd) => {
    if (end !== 'blurred') focusAfterRename.current = sessionId;
    setRenamingId((current) => (current === sessionId ? null : current));
  };
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
      ref={listRef}
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
                const renaming = session.id === renamingId;
                return (
                  <li
                    key={session.id}
                    className={classes.length > 0 ? classes.join(' ') : undefined}
                    draggable={!renaming}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', session.id);
                      setDrag({ sessionId: session.id, groupId: group.id, slot: null });
                    }}
                    onDragOver={inDraggedGroup ? (event) => dragOverEntry(event, entryIndex) : undefined}
                  >
                    <Entry
                      session={session}
                      open={session.id === openSessionId}
                      onOpen={onOpen}
                      editor={
                        renaming ? (
                          <SessionNameEditor sessionId={session.id} label={session.label} onEnd={(end) => endRename(session.id, end)} />
                        ) : undefined
                      }
                    />
                    {session.state === 'ended' && !session.external && (
                      <EndedEntryActions
                        sessionId={session.id}
                        resumable={session.resumable === true}
                        open={session.id === openSessionId}
                        onResumed={onResumed}
                      />
                    )}
                    <button
                      ref={(button) => {
                        if (button) renameButtons.current.set(session.id, button);
                        else renameButtons.current.delete(session.id);
                      }}
                      type="button"
                      className="entry-rename"
                      aria-label="Rename"
                      title="Rename"
                      hidden={renaming}
                      onClick={() => setRenamingId(session.id)}
                    >
                      <PencilIcon />
                    </button>
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
