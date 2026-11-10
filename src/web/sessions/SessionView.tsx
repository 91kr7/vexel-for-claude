import { type DragEvent, type Ref, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { type IBufferRange, Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { type ISearchOptions, SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';
import { desktopFilePathLookup } from '../desktop-bridge';
import { shortcutCommandOf } from '../shortcut-map';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { ProgressIndicator } from '../feedback/ProgressIndicator';
import { GitExplorerButton } from '../git/GitExplorerButton';
import { GitExplorerPanel } from '../git/GitExplorerPanel';
import { useRepositoryLookup } from '../git/repository-lookup-store';
import { CirclePauseIcon, SearchIcon } from '../icons/Icons';
import { folderNameOf } from './Avatar';
import { droppedPathsText } from './dropped-paths-text';
import { openLink } from './link-opener';
import { SessionFooter } from './SessionFooter';
import type { SessionSummary } from './live-session-store';
import { SessionHeader, type SessionHeaderSummary } from './SessionHeader';
import { StopSessionButton } from './StopSessionButton';
import { pageTerminalFontSizeStore, type TerminalFontSizeStore, useTerminalFontSize } from './terminal-font-size-store';
import { TerminalSearchBox, type TerminalSearchResults } from './TerminalSearchBox';
import { TerminalZoomControls } from './TerminalZoomControls';
import { loadWebAddressLinks } from './web-address-links';

const ESCAPE = '\x1b';
const SESSION_ENDED = 1000;
const SESSION_NOT_FOUND = 4404;
const RETRY_DELAY_MS = 2000;
const TERMINAL_LINE_HEIGHT = 1.2;
const LINK_TOOLTIP_OFFSET = 12;
const LINK_TOOLTIP_MAX_WIDTH = 480;
const DROP_NOTICE_MS = 4000;

interface SessionViewProps {
  sessionId: string;
  session?: SessionHeaderSummary;
  sessions?: readonly SessionSummary[];
  onLeaveTerminal: () => void;
  focusRef?: Ref<{ focus(): void }>;
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

// Matched on the produced character, so Ctrl+Shift+- (undo, "_") still reaches the pty.
function zoomShortcut(event: KeyboardEvent, store: TerminalFontSizeStore): (() => void) | null {
  if (!event.ctrlKey || event.altKey || event.metaKey) return null;
  if (event.key === '=' || event.key === '+') return () => store.larger();
  if (event.key === '-') return () => store.smaller();
  if (event.key === '0') return () => store.reset();
  return null;
}

const isFileDrag = (event: DragEvent) => event.dataTransfer.types.includes('Files');

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
function loadTerminalFont(fontFamily: string, fontSize: number): Promise<unknown> {
  const faces = ['400', '500'].map((weight) => document.fonts.load(`${weight} ${fontSize}px ${fontFamily}`));
  return Promise.all(faces).catch(() => undefined);
}

export function SessionView({ sessionId, session, sessions, onLeaveTerminal, focusRef }: SessionViewProps) {
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
  const [dropTarget, setDropTarget] = useState(false);
  const [dropNotice, setDropNotice] = useState(0);
  const fontSizeStore = pageTerminalFontSizeStore();
  const fontSize = useTerminalFontSize(fontSizeStore);
  const [gitRevision, setGitRevision] = useState(0);
  const repository = useRepositoryLookup(session?.folder, gitRevision);
  const [gitOpen, setGitOpen] = useState(false);
  const gitShown = gitOpen && (repository.status === 'repository' || repository.status === 'error');
  const refreshGit = () => setGitRevision((revision) => revision + 1);
  const toggleGit = () => {
    if (!gitShown) refreshGit();
    setGitOpen(!gitShown);
  };
  useImperativeHandle(focusRef, () => ({ focus: () => terminalRef.current?.focus() }), []);

  useEffect(() => {
    if (dropNotice === 0) return;
    const timer = setTimeout(() => setDropNotice(0), DROP_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [dropNotice]);

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
    void loadTerminalFont(fontFamily, fontSizeStore.getSnapshot()).then(() => {
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
      fontSize: fontSizeStore.getSnapshot(),
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

    const listeners = new AbortController();
    const { signal } = listeners;
    let socket: WebSocket;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const send = (message: object) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    };
    const sendSize = () => send({ type: 'resize', cols: terminal.cols, rows: terminal.rows });

    const connect = (reconnecting: boolean) => {
      socket = new WebSocket(attachUrl(sessionId));
      socketRef.current = socket;
      socket.addEventListener('open', sendSize, { signal });
      let snapshotShown = false;
      socket.addEventListener(
        'message',
        (event: MessageEvent<string>) => {
          if (!snapshotShown && reconnecting) {
            terminal.reset();
            setConnectionError(null);
          }
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
          const lost = event.code !== SESSION_ENDED && event.code !== SESSION_NOT_FOUND;
          if (!reconnecting || snapshotShown) {
            terminal.write('\r\n\x1b[2m[Session disconnected]\x1b[0m\r\n');
            setLoading(false);
            setConnectionError(closeMessage(event.code));
          } else if (!lost) {
            setConnectionError(null);
          }
          if (lost) retry = setTimeout(() => connect(true), RETRY_DELAY_MS);
        },
        { signal },
      );
    };
    connect(false);
    terminal.attachCustomKeyEventHandler((event) => {
      if (shortcutCommandOf(event)) return false;
      const shortcut = isCtrlShiftKey(event, 'l')
        ? () => onLeaveTerminalRef.current()
        : isCtrlShiftKey(event, 'f')
          ? openSearch
          : zoomShortcut(event, fontSizeStore);
      if (!shortcut) return true;
      event.preventDefault();
      if (event.type === 'keydown') shortcut();
      return false;
    });
    const inputSubscription = terminal.onData((data) => send({ type: 'input', data }));
    const resizeSubscription = terminal.onResize(sendSize);
    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(container);
    const unsubscribeFontSize = fontSizeStore.subscribe(() => {
      terminal.options.fontSize = fontSizeStore.getSnapshot();
      fitAddon.fit();
    });
    terminal.focus();

    return () => {
      listeners.abort();
      clearTimeout(retry);
      resizeObserver.disconnect();
      unsubscribeFontSize();
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

  const acceptsDrop = () => session?.state !== 'ended' && desktopFilePathLookup() !== null;

  const dragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    if (acceptsDrop()) setDropTarget(true);
  };

  const dragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(false);
  };

  const drop = (event: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    setDropTarget(false);
    const pathOf = desktopFilePathLookup();
    if (!pathOf) {
      setDropNotice((count) => count + 1);
      return;
    }
    const terminal = terminalRef.current;
    if (session?.state === 'ended' || !terminal) return;
    const paths = Array.from(event.dataTransfer.files, pathOf).filter((path) => path !== '');
    if (paths.length === 0) return;
    terminal.paste(droppedPathsText(paths));
    terminal.focus();
  };

  return (
    <div className="session-view">
      <SessionHeader
        session={session}
        leadingActions={
          <>
            <GitExplorerButton lookup={repository} open={gitShown} onToggle={toggleGit} />
            <button type="button" className="session-search-button" aria-label="Search" title="Search (Ctrl+Shift+F)" onClick={openSearch}>
              <SearchIcon />
            </button>
          </>
        }
        actions={
          <>
            {session?.state !== 'ended' && (
              <button type="button" className="button-interrupt session-interrupt" onClick={interrupt}>
                <CirclePauseIcon />
                Interrupt
              </button>
            )}
            <StopSessionButton sessionId={sessionId} state={session?.state} folderName={session && folderNameOf(session.folder)} />
          </>
        }
      />
      {connectionError && <ErrorMessage className="session-alert">{connectionError}</ErrorMessage>}
      <div className="session-workspace">
        <div
          className={dropTarget ? 'session-terminal-panel drop-target' : 'session-terminal-panel'}
          role="region"
          aria-label={session ? `Terminal: ${folderNameOf(session.folder)}` : 'Terminal'}
          onDragOver={dragOver}
          onDragLeave={dragLeave}
          onDrop={drop}
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
          {dropNotice > 0 && (
            <div className="terminal-drop-notice" role="status">
              Paths can be dropped only in the desktop app.
            </div>
          )}
          {loading && (
            <div className="session-terminal-loading">
              <ProgressIndicator />
            </div>
          )}
        </div>
        {gitShown && <GitExplorerPanel lookup={repository} onRefresh={refreshGit} sessions={sessions} />}
      </div>
      {linkTooltip && (
        <div className="terminal-link-tooltip" role="tooltip" style={{ left: linkTooltip.left, top: linkTooltip.top }}>
          {linkTooltip.address}
        </div>
      )}
      <SessionFooter
        session={session}
        end={
          <TerminalZoomControls
            size={fontSize}
            onSmaller={() => fontSizeStore.smaller()}
            onReset={() => fontSizeStore.reset()}
            onLarger={() => fontSizeStore.larger()}
          />
        }
      />
    </div>
  );
}
