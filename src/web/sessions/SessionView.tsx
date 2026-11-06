import { useEffect, useRef, useState } from 'react';
import { type IBufferRange, Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { type ISearchOptions, SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { ProgressIndicator } from '../feedback/ProgressIndicator';
import { SearchIcon } from '../icons/Icons';
import { folderNameOf } from './Avatar';
import { openLink } from './link-opener';
import { SessionHeader, type SessionHeaderSummary } from './SessionHeader';
import { StopSessionButton } from './StopSessionButton';
import { TerminalSearchBox, type TerminalSearchResults } from './TerminalSearchBox';
import { loadWebAddressLinks } from './web-address-links';

const ESCAPE = '\x1b';
const SESSION_ENDED = 1000;
const SESSION_NOT_FOUND = 4404;
const TERMINAL_FONT_SIZE = 12;
const TERMINAL_LINE_HEIGHT = 1.2;
const LINK_TOOLTIP_OFFSET = 12;
const LINK_TOOLTIP_MAX_WIDTH = 480;

interface SessionViewProps {
  sessionId: string;
  session?: SessionHeaderSummary;
  onLeaveTerminal: () => void;
}

interface TerminalSearch {
  addon: SearchAddon;
  options: ISearchOptions;
}

interface LinkTooltip {
  address: string;
  left: number;
  top: number;
}

const isCtrlShiftKey = (event: KeyboardEvent, key: string) =>
  event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey && event.key.toLowerCase() === key;

function attachUrl(sessionId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/sessions/${encodeURIComponent(sessionId)}/attach`;
}

function closeMessage(code: number): string | null {
  if (code === SESSION_ENDED) return null;
  return code === SESSION_NOT_FOUND ? 'The session no longer exists.' : 'Connection to the session lost.';
}

function openOnCtrlClick(event: MouseEvent, address: string): void {
  if (event.ctrlKey) openLink(address);
}

function rangeText(terminal: Terminal, { start, end }: IBufferRange): string {
  let text = '';
  for (let y = start.y; y <= end.y; y++) {
    const line = terminal.buffer.active.getLine(y - 1);
    text += line?.translateToString(true, y === start.y ? start.x - 1 : 0, y === end.y ? end.x : undefined) ?? '';
  }
  return text;
}

function tooltipAt(event: MouseEvent, address: string): LinkTooltip {
  const rightmost = window.innerWidth - LINK_TOOLTIP_MAX_WIDTH - LINK_TOOLTIP_OFFSET;
  return {
    address,
    left: Math.max(LINK_TOOLTIP_OFFSET, Math.min(event.clientX + LINK_TOOLTIP_OFFSET, rightmost)),
    top: event.clientY + LINK_TOOLTIP_OFFSET,
  };
}

function cssVar(element: Element, name: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim();
}

function terminalTheme(element: Element) {
  return {
    background: cssVar(element, '--term-bg'),
    foreground: cssVar(element, '--term-fg'),
    cursor: cssVar(element, '--term-cursor'),
    cursorAccent: cssVar(element, '--term-bg'),
    selectionBackground: cssVar(element, '--term-selection'),
  };
}

function searchOptions(element: Element): ISearchOptions {
  const match = cssVar(element, '--term-match-bg');
  const currentBorder = cssVar(element, '--term-match-current-border');
  return {
    caseSensitive: false,
    regex: false,
    wholeWord: false,
    decorations: {
      matchBackground: match,
      matchOverviewRuler: match,
      activeMatchBackground: cssVar(element, '--term-match-current-bg'),
      activeMatchBorder: currentBorder,
      activeMatchColorOverviewRuler: currentBorder,
    },
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
  const searchRef = useRef<TerminalSearch | null>(null);
  const searchFieldRef = useRef<HTMLInputElement>(null);
  const onLeaveTerminalRef = useRef(onLeaveTerminal);
  onLeaveTerminalRef.current = onLeaveTerminal;
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [linkTooltip, setLinkTooltip] = useState<LinkTooltip | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TerminalSearchResults | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setLoading(true);
    setConnectionError(null);
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults(null);

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
      allowProposedApi: true,
      fontSize: TERMINAL_FONT_SIZE,
      lineHeight: TERMINAL_LINE_HEIGHT,
      theme: terminalTheme(container),
      linkHandler: {
        activate: openOnCtrlClick,
        hover: (event, address, range) => {
          if (rangeText(terminal, range) !== address) setLinkTooltip(tooltipAt(event, address));
        },
        leave: () => setLinkTooltip(null),
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    const webAddressLinks = loadWebAddressLinks(terminal, openOnCtrlClick);
    const searchAddon = new SearchAddon();
    terminal.loadAddon(searchAddon);
    const searchResultsSubscription = searchAddon.onDidChangeResults(({ resultIndex, resultCount }) =>
      setSearchResults({ index: resultIndex, total: resultCount }),
    );
    terminal.open(container);
    fitAddon.fit();
    terminalRef.current = terminal;
    searchRef.current = { addon: searchAddon, options: searchOptions(container) };

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
        terminal.write('\r\n\x1b[2m[Session disconnected]\x1b[0m\r\n');
        setLoading(false);
        setConnectionError(closeMessage(event.code));
      },
      { signal },
    );
    terminal.attachCustomKeyEventHandler((event) => {
      const shortcut = isCtrlShiftKey(event, 'l') ? () => onLeaveTerminalRef.current() : isCtrlShiftKey(event, 'f') ? openSearch : null;
      if (!shortcut) return true;
      event.preventDefault();
      if (event.type === 'keydown') shortcut();
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
      webAddressLinks.dispose();
      searchResultsSubscription.dispose();
      socket.close();
      terminal.dispose();
      setLinkTooltip(null);
      terminalRef.current = null;
      socketRef.current = null;
      searchRef.current = null;
    };
  }

  const interrupt = () => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'input', data: ESCAPE }));
    }
    terminalRef.current?.focus();
  };

  const openSearch = () => {
    const field = searchFieldRef.current;
    if (!field) {
      setSearchOpen(true);
      return;
    }
    field.focus();
    field.select();
  };

  const clearSearch = () => {
    searchRef.current?.addon.clearDecorations();
    terminalRef.current?.clearSelection();
    setSearchResults(null);
  };

  const changeSearchQuery = (query: string) => {
    setSearchQuery(query);
    if (query === '') clearSearch();
    else searchRef.current?.addon.findNext(query, searchRef.current.options);
  };

  const findNext = () => {
    if (searchQuery !== '') searchRef.current?.addon.findNext(searchQuery, searchRef.current.options);
  };

  const findPrevious = () => {
    if (searchQuery !== '') searchRef.current?.addon.findPrevious(searchQuery, searchRef.current.options);
  };

  const closeSearch = () => {
    clearSearch();
    setSearchOpen(false);
    setSearchQuery('');
    terminalRef.current?.focus();
  };

  return (
    <div className="session-view">
      <SessionHeader
        session={session}
        actions={
          <>
            <button type="button" className="session-search-button" aria-label="Search" title="Search (Ctrl+Shift+F)" onClick={openSearch}>
              <SearchIcon />
            </button>
            {session?.state !== 'ended' && (
              <button type="button" className="button-danger session-interrupt" onClick={interrupt}>
                <span className="stop-glyph" aria-hidden="true">
                  ■
                </span>
                Interrupt
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
        aria-label={session ? `Terminal: ${folderNameOf(session.folder)}` : 'Terminal'}
      >
        <div className="session-terminal" ref={containerRef} />
        {searchOpen && (
          <TerminalSearchBox
            query={searchQuery}
            results={searchResults}
            inputRef={searchFieldRef}
            onQueryChange={changeSearchQuery}
            onNext={findNext}
            onPrevious={findPrevious}
            onClose={closeSearch}
          />
        )}
        {loading && (
          <div className="session-terminal-loading">
            <ProgressIndicator />
          </div>
        )}
      </div>
      {linkTooltip && (
        <div className="terminal-link-tooltip" role="tooltip" style={{ left: linkTooltip.left, top: linkTooltip.top }}>
          {linkTooltip.address}
        </div>
      )}
      <div className="session-hint-row">
        <span className="session-hint">
          <kbd className="kbd-badge">Ctrl</kbd>+<kbd className="kbd-badge">Shift</kbd>+<kbd className="kbd-badge">L</kbd> back to the list
        </span>
      </div>
    </div>
  );
}
