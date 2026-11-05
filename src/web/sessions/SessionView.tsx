import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

const ESCAPE = '\x1b';

interface SessionViewProps {
  sessionId: string;
}

function attachUrl(sessionId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/sessions/${encodeURIComponent(sessionId)}/attach`;
}

export function SessionView({ sessionId }: SessionViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal({ cursorBlink: true, scrollback: 10_000 });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    fitAddon.fit();
    terminalRef.current = terminal;

    const socket = new WebSocket(attachUrl(sessionId));
    socketRef.current = socket;
    const send = (message: object) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    };
    const sendSize = () => send({ type: 'resize', cols: terminal.cols, rows: terminal.rows });

    const listeners = new AbortController();
    const { signal } = listeners;
    socket.addEventListener('open', sendSize, { signal });
    socket.addEventListener('message', (event: MessageEvent<string>) => terminal.write(event.data), { signal });
    socket.addEventListener(
      'close',
      () => terminal.write('\r\n\x1b[2m[Sessione disconnessa]\x1b[0m\r\n'),
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
      <div className="session-toolbar">
        <button type="button" onClick={interrupt}>
          Interrompi
        </button>
      </div>
      <div className="session-terminal" ref={containerRef} />
    </div>
  );
}
