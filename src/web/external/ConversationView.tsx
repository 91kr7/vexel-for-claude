import { useEffect, useRef, useState } from 'react';
import { ResumeHereButton } from './ResumeHereButton';

type ConversationItem =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool_call'; name: string; summary: string }
  | { kind: 'tool_result'; text: string; truncated: boolean };

interface ConversationViewProps {
  sessionId: string;
  onResumed: (id: string) => void;
}

function conversationUrl(sessionId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/external-sessions/${encodeURIComponent(sessionId)}/conversation`;
}

function ItemBlock({ item }: { item: ConversationItem }) {
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
      return (
        <article className="conversation-item item-tool-call">
          <h3>Strumento: {item.name}</h3>
          <p>{item.summary}</p>
        </article>
      );
    case 'tool_result':
      return (
        <article className="conversation-item item-tool-result">
          <h3>Risultato</h3>
          <pre>{item.truncated ? `${item.text}\n…` : item.text}</pre>
        </article>
      );
  }
}

export function ConversationView({ sessionId, onResumed }: ConversationViewProps) {
  const [items, setItems] = useState<ConversationItem[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [items]);

  return (
    <div className="conversation-view">
      <div className="session-toolbar">
        <ResumeHereButton sessionId={sessionId} onResumed={onResumed} />
      </div>
      <div className="conversation-items">
        {items === null && <p className="empty-state">{unavailable ? 'Conversazione non disponibile.' : 'Caricamento…'}</p>}
        {items?.length === 0 && <p className="empty-state">Nessun messaggio.</p>}
        {items?.map((item, index) => <ItemBlock key={index} item={item} />)}
        <div ref={endRef} />
      </div>
    </div>
  );
}
