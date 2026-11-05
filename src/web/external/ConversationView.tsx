import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, LockIcon, WrenchIcon } from '../icons/Icons';
import { SessionHeader, type SessionHeaderSummary } from '../sessions/SessionHeader';
import { ResumeHereButton } from './ResumeHereButton';

interface ItemRef {
  offset: number;
  block: number;
}

type ConversationItem =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool_call'; name: string; summary: string; ref?: ItemRef }
  | { kind: 'tool_result'; text: string; truncated: boolean; ref?: ItemRef };

type FullContent = { status: 'idle' | 'loading' | 'failed' } | { status: 'loaded'; text: string };

interface ConversationViewProps {
  sessionId: string;
  session?: SessionHeaderSummary;
  onResumed: (id: string) => void;
}

const AT_END_TOLERANCE_PX = 8;

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

function useExpandable(sessionId: string, ref: ItemRef | undefined) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState<FullContent>({ status: 'idle' });

  const toggle = () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (!ref || content.status === 'loading' || content.status === 'loaded') return;
    setContent({ status: 'loading' });
    fetch(itemContentUrl(sessionId, ref))
      .then((response) => (response.ok ? (response.json() as Promise<{ text: string }>) : Promise.reject(new Error())))
      .then(
        (body) => setContent({ status: 'loaded', text: body.text }),
        () => setContent({ status: 'failed' }),
      );
  };

  return { expanded, content, toggle };
}

function ToggleButton({ expanded, onClick }: { expanded: boolean; onClick: () => void }) {
  return (
    <button type="button" className="item-toggle" aria-expanded={expanded} onClick={onClick}>
      {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
      {expanded ? 'Comprimi' : 'Espandi'}
    </button>
  );
}

function LoadState({ content }: { content: FullContent }) {
  if (content.status === 'loading') return <p className="item-load-state">Caricamento…</p>;
  if (content.status === 'failed') return <p className="item-load-state error">Impossibile caricare il contenuto completo.</p>;
  return null;
}

function ToolCallBlock({ sessionId, item }: { sessionId: string; item: Extract<ConversationItem, { kind: 'tool_call' }> }) {
  const { expanded, content, toggle } = useExpandable(sessionId, item.ref);
  return (
    <article className="conversation-item item-tool-call">
      <div className="item-tool-line">
        <WrenchIcon />
        <h3>Strumento: {item.name}</h3>
        <p className="item-tool-summary" title={item.summary}>
          {item.summary}
        </p>
        {item.ref && <ToggleButton expanded={expanded} onClick={toggle} />}
      </div>
      {expanded && (content.status === 'loaded' ? <pre className="item-full">{content.text}</pre> : <LoadState content={content} />)}
    </article>
  );
}

function ToolResultBlock({ sessionId, item }: { sessionId: string; item: Extract<ConversationItem, { kind: 'tool_result' }> }) {
  const expandable = item.truncated && item.ref !== undefined;
  const { expanded, content, toggle } = useExpandable(sessionId, item.ref);
  const showFull = expanded && content.status === 'loaded';
  return (
    <article className="conversation-item item-tool-result">
      <div className="item-tool-line">
        <h3>Risultato</h3>
        {expandable && <ToggleButton expanded={expanded} onClick={toggle} />}
      </div>
      <pre>{showFull ? content.text : item.truncated ? `${item.text}\n…` : item.text}</pre>
      {expanded && <LoadState content={content} />}
    </article>
  );
}

function ItemBlock({ sessionId, item }: { sessionId: string; item: ConversationItem }) {
  switch (item.kind) {
    case 'user':
      return (
        <article className="conversation-item item-user">
          <h3>Utente</h3>
          <p>{item.text}</p>
        </article>
      );
    case 'assistant':
      return (
        <article className="conversation-item item-assistant">
          <h3>Claude</h3>
          <p>{item.text}</p>
        </article>
      );
    case 'tool_call':
      return <ToolCallBlock sessionId={sessionId} item={item} />;
    case 'tool_result':
      return <ToolResultBlock sessionId={sessionId} item={item} />;
  }
}

export function ConversationView({ sessionId, session, onResumed }: ConversationViewProps) {
  const [items, setItems] = useState<ConversationItem[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const followEndRef = useRef(true);

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
    const list = listRef.current;
    if (list && followEndRef.current) list.scrollTop = list.scrollHeight;
  }, [items]);

  return (
    <div className="conversation-view">
      <SessionHeader
        session={session}
        actions={<ResumeHereButton sessionId={sessionId} onResumed={onResumed} />}
        notice={
          <span className="read-only-notice">
            <LockIcon />
            Sola lettura
          </span>
        }
      />
      <div className="conversation-items" ref={listRef}>
        <div className="conversation-column">
          {items === null && <p className="empty-state">{unavailable ? 'Conversazione non disponibile.' : 'Caricamento…'}</p>}
          {items?.length === 0 && <p className="empty-state">Nessun messaggio.</p>}
          {items?.map((item, index) => <ItemBlock key={index} sessionId={sessionId} item={item} />)}
        </div>
      </div>
    </div>
  );
}
