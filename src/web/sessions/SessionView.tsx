import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { ProgressIndicator } from '../feedback/ProgressIndicator';
import { folderNameOf } from './Avatar';
import { SessionHeader, type SessionHeaderSummary } from './SessionHeader';
import { StopSessionButton } from './StopSessionButton';

const ESCAPE = '\x1b';
const SESSION_ENDED = 1000;
const SESSION_NOT_FOUND = 4404;
const TERMINAL_FONT_SIZE = 12;
const TERMINAL_LINE_HEIGHT = 1.2;

interface SessionViewProps {
  sessionId: string;
  session?: SessionHeaderSummary;
  onLeaveTerminal: () => void;
}

const isLeaveTerminalKey = (event: KeyboardEvent) =>
  event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey && event.key.toLowerCase() === 'l';

function attachUrl(sessionId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/sessions/${encodeURIComponent(sessionId)}/attach`;
}

function closeMessage(code: number): string | null {
  if (code === SESSION_ENDED) return null;
  return code === SESSION_NOT_FOUND ? 'La sessione non esiste più.' : 'Connessione alla sessione persa.';
}

function cssVar(element: Element, name: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim();
}

function terminalTheme(element: Element) {
  return {
    background: cssVar(element, '--term-bg'),
    foreground: cssVar(element, '--term-fg'),
    cursor: cssVar(element, '--accent-primary'),
    cursorAccent: cssVar(element, '--term-bg'),
    selectionBackground: cssVar(element, '--accent-selection'),
  };
}

// xterm measures the cell size when it opens, so the font must be ready first.
function loadTerminalFont(fontFamily: string): Promise<unknown> {
  const faces = ['400', '500'].map((weight) => document.fonts.load(`${weight} ${TERMINAL_FONT_SIZE}px ${fontFamily}`));
  return Promise.all(faces).catch(() => undefined);
}

export function SessionView({ sessionId, session, onLeaveTerminal }: SessionViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const onLeaveTerminalRef = useRef(onLeaveTerminal);
  onLeaveTerminalRef.current = onLeaveTerminal;
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setLoading(true);
    setConnectionError(null);

    const fontFamily = cssVar(container, '--font-mono');
    let cancelled = false;
    let closeTerminal: (() => void) | undefined;
    void loadTerminalFont(fontFamily).then(() => {
      if (!cancelled) closeTerminal = openTerminal(container, fontFamily);
    });
    return () => {
      cancelled = true;
      closeTerminal?.();
    };
  }, [sessionId]);

  function openTerminal(container: HTMLDivElement, fontFamily: string): () => void {
    const terminal = new Terminal({
      cursorBlink: true,
      scrollback: 10_000,
      fontFamily,
      fontSize: TERMINAL_FONT_SIZE,
      lineHeight: TERMINAL_LINE_HEIGHT,
      theme: terminalTheme(container),
    });
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
    terminal.attachCustomKeyEventHandler((event) => {
      if (!isLeaveTerminalKey(event)) return true;
      event.preventDefault();
      if (event.type === 'keydown') onLeaveTerminalRef.current();
      return false;
    });
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
  }

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
            {session?.state !== 'ended' && (
              <button type="button" className="button-danger session-interrupt" onClick={interrupt}>
                <span className="stop-glyph" aria-hidden="true">
                  ■
                </span>
                Interrompi
              </button>
            )}
            <StopSessionButton sessionId={sessionId} state={session?.state} folderName={session && folderNameOf(session.folder)} />
          </>
        }
      />
      {connectionError && <ErrorMessage className="session-alert">{connectionError}</ErrorMessage>}
      <div
        className="session-terminal-panel"
        role="region"
        aria-label={session ? `Terminale di ${folderNameOf(session.folder)}` : 'Terminale'}
      >
        <div className="session-terminal" ref={containerRef} />
        {loading && (
          <div className="session-terminal-loading">
            <ProgressIndicator />
          </div>
        )}
      </div>
      <div className="session-hint-row">
        <span className="session-hint">
          <kbd className="kbd-badge">Ctrl</kbd>+<kbd className="kbd-badge">Maiusc</kbd>+<kbd className="kbd-badge">L</kbd> torna all'elenco
        </span>
      </div>
    </div>
  );
}
