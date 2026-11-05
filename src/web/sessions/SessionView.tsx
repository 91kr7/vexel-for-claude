import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { ProgressIndicator } from '../feedback/ProgressIndicator';
import { CircleStopIcon } from '../icons/Icons';
import { SessionHeader, type SessionHeaderSummary } from './SessionHeader';
import { StopSessionButton } from './StopSessionButton';

const ESCAPE = '\x1b';
const SESSION_ENDED = 1000;
const SESSION_NOT_FOUND = 4404;

interface SessionViewProps {
  sessionId: string;
  session?: SessionHeaderSummary;
}

function attachUrl(sessionId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/sessions/${encodeURIComponent(sessionId)}/attach`;
}

function closeMessage(code: number): string | null {
  if (code === SESSION_ENDED) return null;
  return code === SESSION_NOT_FOUND ? 'La sessione non esiste più.' : 'Connessione alla sessione persa.';
}

export function SessionView({ sessionId, session }: SessionViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal({ cursorBlink: true, scrollback: 10_000 });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    fitAddon.fit();
    terminalRef.current = terminal;
    setLoading(true);
    setConnectionError(null);

    const socket = new WebSocket(attachUrl(sessionId));
    socketRef.current = socket;
    const send = (message: object) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    };
    const sendSize = () => send({ type: 'resize', cols: terminal.cols, rows: terminal.rows });

    const listeners = new AbortController();
    const { signal } = listeners;
    socket.addEventListener('open', sendSize, { signal });
    let snapshotShown = false;
    socket.addEventListener(
      'message',
      (event: MessageEvent<string>) => {
        terminal.write(event.data);
        if (snapshotShown) return;
        snapshotShown = true;
        setLoading(false);
      },
      { signal },
    );
    socket.addEventListener(
      'close',
      (event: CloseEvent) => {
        terminal.write('\r\n\x1b[2m[Sessione disconnessa]\x1b[0m\r\n');
        setLoading(false);
        setConnectionError(closeMessage(event.code));
      },
      { signal },
    );
    const inputSubscription = terminal.onData((data) => send({ type: 'input', data }));
    const resizeSubscription = terminal.onResize(sendSize);
    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(container);
    terminal.focus();

    return () => {
      listeners.abort();
      resizeObserver.disconnect();
      inputSubscription.dispose();
      resizeSubscription.dispose();
      socket.close();
      terminal.dispose();
      terminalRef.current = null;
      socketRef.current = null;
    };
  }, [sessionId]);

  const interrupt = () => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'input', data: ESCAPE }));
    }
    terminalRef.current?.focus();
  };

  return (
    <div className="session-view">
      <SessionHeader
        session={session}
        actions={
          <>
            <button type="button" onClick={interrupt}>
              <CircleStopIcon />
              Interrompi
            </button>
            <StopSessionButton sessionId={sessionId} state={session?.state} />
          </>
        }
      />
      {connectionError && <ErrorMessage className="session-alert">{connectionError}</ErrorMessage>}
      <div className="session-terminal-frame">
        <div className="session-terminal" ref={containerRef} />
        {loading && (
          <div className="session-terminal-loading">
            <ProgressIndicator />
          </div>
        )}
      </div>
    </div>
  );
}
