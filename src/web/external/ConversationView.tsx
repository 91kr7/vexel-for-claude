import { type ComponentType, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { ProgressIndicator } from '../feedback/ProgressIndicator';
import {
  ArrowDownIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleXIcon,
  LockIcon,
  PencilIcon,
  SparkIcon,
  TerminalIcon,
  WrenchIcon,
} from '../icons/Icons';
import { SessionHeader, type SessionHeaderSummary } from '../sessions/SessionHeader';
import { ResumeHereButton } from './ResumeHereButton';

interface ItemRef {
  offset: number;
  block: number;
}

type UserItem = { kind: 'user'; text: string; timestamp?: string };
type AssistantItem = { kind: 'assistant'; text: string };
type ToolCall = { kind: 'tool_call'; name: string; summary: string; moreInput?: true; id?: string; ref?: ItemRef };
type ToolResult = { kind: 'tool_result'; text: string; truncated: boolean; isError?: true; toolUseId?: string; ref?: ItemRef };
type ConversationItem = UserItem | AssistantItem | ToolCall | ToolResult;

type ToolEntry = { key: number; kind: 'tool'; call?: ToolCall; result?: ToolResult };
type Entry = { key: number; kind: 'message'; item: UserItem | AssistantItem } | ToolEntry;

type FullContent = { status: 'idle' | 'loading' | 'failed' } | { status: 'loaded'; text: string };

interface ConversationViewProps {
  sessionId: string;
  session?: SessionHeaderSummary;
  onResumed: (id: string) => void;
}

const AT_END_TOLERANCE_PX = 8;
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const INLINE_CODE = /`([^`\n]+)`/;

function conversationUrl(sessionId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/external-sessions/${encodeURIComponent(sessionId)}/conversation`;
}

function itemContentUrl(sessionId: string, ref: ItemRef): string {
  return `/api/external-sessions/${encodeURIComponent(sessionId)}/items?offset=${ref.offset}&block=${ref.block}`;
}

function isAtEnd(element: HTMLElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= AT_END_TOLERANCE_PX;
}

const twoDigits = (value: number) => String(value).padStart(2, '0');

export function formatMessageTime(iso: string, now: Date): string {
  const time = new Date(iso);
  if (Number.isNaN(time.getTime())) return '';
  const clock = `${twoDigits(time.getHours())}:${twoDigits(time.getMinutes())}`;
  if (time.toDateString() === now.toDateString()) return clock;
  return `${twoDigits(time.getDate())}/${twoDigits(time.getMonth() + 1)}/${time.getFullYear()} ${clock}`;
}

function entriesOf(items: ConversationItem[]): Entry[] {
  const entries: Entry[] = [];
  const waitingCalls = new Map<string, ToolEntry>();
  items.forEach((item, index) => {
    if (item.kind === 'tool_call') {
      const card: ToolEntry = { key: index, kind: 'tool', call: item };
      entries.push(card);
      if (item.id !== undefined) waitingCalls.set(item.id, card);
    } else if (item.kind === 'tool_result') {
      const card = item.toolUseId === undefined ? undefined : waitingCalls.get(item.toolUseId);
      if (card && item.toolUseId !== undefined) {
        card.result = item;
        waitingCalls.delete(item.toolUseId);
      } else {
        entries.push({ key: index, kind: 'tool', result: item });
      }
    } else {
      entries.push({ key: index, kind: 'message', item });
    }
  });
  return entries;
}

function withInlineCode(text: string): ReactNode[] {
  return text
    .split(INLINE_CODE)
    .map((part, index) => (index % 2 === 1 ? <code key={index} className="mono inline-code">{part}</code> : part));
}

function toolIconOf(name: string | undefined): ComponentType {
  if (name === 'Bash') return TerminalIcon;
  if (name !== undefined && EDIT_TOOLS.has(name)) return PencilIcon;
  return WrenchIcon;
}

function useFullContent(sessionId: string, ref: ItemRef | undefined, wanted: boolean) {
  const [content, setContent] = useState<FullContent>({ status: 'idle' });
  const offset = ref?.offset;
  const block = ref?.block;

  useEffect(() => {
    if (!wanted || offset === undefined || block === undefined || content.status !== 'idle') return;
    setContent({ status: 'loading' });
    fetch(itemContentUrl(sessionId, { offset, block }))
      .then((response) => (response.ok ? (response.json() as Promise<{ text: string }>) : Promise.reject(new Error())))
      .then(
        (body) => setContent({ status: 'loaded', text: body.text }),
        () => setContent({ status: 'failed' }),
      );
  }, [sessionId, wanted, offset, block, content.status]);

  const retry = () => setContent((current) => (current.status === 'failed' ? { status: 'idle' } : current));
  return { content, retry };
}

function OutcomeChip({ isError }: { isError: boolean }) {
  return isError ? (
    <span className="chip label-m tool-outcome tool-outcome-failed">
      <CircleXIcon />
      Fallito
    </span>
  ) : (
    <span className="chip label-m tool-outcome tool-outcome-done">
      <CheckIcon />
      Fatto
    </span>
  );
}

function ToolCard({ sessionId, call, result }: { sessionId: string; call?: ToolCall; result?: ToolResult }) {
  const [open, setOpen] = useState(false);
  const input = useFullContent(sessionId, call?.ref, open && call?.moreInput === true);
  const output = useFullContent(sessionId, result?.ref, open && result?.truncated === true);
  const name = call ? call.name : 'Risultato';
  const Icon = toolIconOf(call?.name);

  const toggle = () => {
    if (!open) {
      input.retry();
      output.retry();
    }
    setOpen(!open);
  };

  const blocks: string[] = [];
  if (input.content.status === 'loaded' && input.content.text) blocks.push(input.content.text);
  if (result) {
    const text = output.content.status === 'loaded' ? output.content.text : result.truncated ? `${result.text}\n…` : result.text;
    if (text) blocks.push(text);
  }
  const states = [input.content.status, output.content.status];

  return (
    <article className="tool-card" aria-label={`Strumento: ${name}`}>
      <button type="button" className="tool-card-toggle" aria-expanded={open} onClick={toggle}>
        <Icon />
        <span className="label-l">{name}</span>
        <span className="mono body-m tool-card-argument" title={call?.summary}>
          {call?.summary}
        </span>
        {result && <OutcomeChip isError={result.isError === true} />}
        {open ? <ChevronDownIcon /> : <ChevronRightIcon />}
      </button>
      {open && blocks.length > 0 && <pre className="mono body-s tool-card-output">{blocks.join('\n\n')}</pre>}
      {open && states.includes('loading') && <ProgressIndicator className="body-s tool-card-state" />}
      {open && states.includes('failed') && (
        <ErrorMessage className="body-s tool-card-state">Impossibile caricare il contenuto completo.</ErrorMessage>
      )}
    </article>
  );
}

function MessageBlock({ item }: { item: UserItem | AssistantItem }) {
  if (item.kind === 'assistant') {
    return (
      <article className="claude-message" aria-label="Claude">
        <SparkIcon />
        <div className="body-l claude-message-text">{withInlineCode(item.text)}</div>
      </article>
    );
  }
  const time = item.timestamp === undefined ? '' : formatMessageTime(item.timestamp, new Date());
  return (
    <article className="user-bubble" aria-label="Utente">
      <div className="body-l user-bubble-text">{item.text}</div>
      {time && (
        <time className="body-s user-bubble-time" dateTime={item.timestamp}>
          {time}
        </time>
      )}
    </article>
  );
}

export function ConversationView({ sessionId, session, onResumed }: ConversationViewProps) {
  const [items, setItems] = useState<ConversationItem[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const followEndRef = useRef(true);
  const countedRef = useRef(0);
  const entries = useMemo(() => entriesOf(items ?? []), [items]);

  useEffect(() => {
    const socket = new WebSocket(conversationUrl(sessionId));
    const listeners = new AbortController();
    let loaded = false;
    socket.addEventListener(
      'message',
      (event: MessageEvent<string>) => {
        let message: { type?: unknown; items?: unknown };
        try {
          message = JSON.parse(event.data) as typeof message;
        } catch {
          return;
        }
        if (message.type !== 'items' || !Array.isArray(message.items)) return;
        const received = message.items as ConversationItem[];
        const list = listRef.current;
        followEndRef.current = !loaded || !list || isAtEnd(list);
        loaded = true;
        setItems((current) => [...(current ?? []), ...received]);
      },
      { signal: listeners.signal },
    );
    socket.addEventListener(
      'close',
      () => {
        if (!loaded) setUnavailable(true);
      },
      { signal: listeners.signal },
    );
    return () => {
      listeners.abort();
      socket.close();
    };
  }, [sessionId]);

  useLayoutEffect(() => {
    const added = entries.length - countedRef.current;
    countedRef.current = entries.length;
    const list = listRef.current;
    if (!list) return;
    if (followEndRef.current) list.scrollTop = list.scrollHeight;
    else if (added > 0) setUnseen((count) => count + added);
  }, [entries]);

  const onScroll = () => {
    const list = listRef.current;
    if (list && isAtEnd(list)) setUnseen(0);
  };

  const jumpToEnd = () => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
    setUnseen(0);
  };

  return (
    <div className="conversation-view">
      <SessionHeader
        session={session}
        external
        line={session && `Aperta in un altro terminale · ${session.folder}`}
        actions={<ResumeHereButton sessionId={sessionId} onResumed={onResumed} />}
        notice={
          <span className="chip label-l read-only-chip">
            <LockIcon />
            Sola lettura
          </span>
        }
      />
      <div className="conversation-panel">
        <div className="conversation-items" ref={listRef} onScroll={onScroll}>
          <div className="conversation-column">
            {items === null &&
              (unavailable ? (
                <ErrorMessage className="conversation-status">Conversazione non disponibile.</ErrorMessage>
              ) : (
                <ProgressIndicator className="conversation-status" />
              ))}
            {items?.length === 0 && <p className="empty-state">Nessun messaggio.</p>}
            {entries.map((entry) =>
              entry.kind === 'tool' ? (
                <ToolCard key={entry.key} sessionId={sessionId} call={entry.call} result={entry.result} />
              ) : (
                <MessageBlock key={entry.key} item={entry.item} />
              ),
            )}
          </div>
        </div>
        {unseen > 0 && (
          <button type="button" className="btn label-l new-messages" onClick={jumpToEnd}>
            <ArrowDownIcon />
            {unseen === 1 ? '1 nuovo messaggio' : `${unseen} nuovi messaggi`}
          </button>
        )}
      </div>
    </div>
  );
}
