# Module sessions

| Component | Type | Path | Responsibility | Spec |
|-----------|------|------|----------------|------|
| SessionRegistry | backend service | `src/server/sessions/session-registry.ts` | Spawns the CLI in a pty (new or `--resume`) with the hook settings and keeps each session by id, with its viewers, pids and how its process ended | `specs/session-registry.md` |
| TerminalMirror | backend service | `src/server/sessions/terminal-mirror.ts` | Headless terminal of a session that gives a serialized snapshot | `specs/terminal-mirror.md` |
| StartSessionRoute | REST endpoint | `src/server/sessions/start-session-route.ts` | `POST /api/sessions`: starts a session in an existing folder | `specs/start-session-route.md` |
| StopSessionRoute | REST endpoint | `src/server/sessions/stop-session-route.ts` | `POST /api/sessions/:id/stop`: stops the CLI process, SIGTERM then SIGKILL | `specs/stop-session-route.md` |
| AttachSessionRoute | REST endpoint (WebSocket) | `src/server/sessions/attach-session-route.ts` | `GET /api/sessions/:id/attach`: snapshot, live output, input and resize | `specs/attach-session-route.md` |
| SessionView | UI component | `src/web/sessions/SessionView.tsx` | Open hosted session: 40 px subbar with "Search", text size controls, "Interrupt" and "Terminate", xterm.js terminal on a panel that stays dark in both themes, links opened with Ctrl+click and the address tooltip of hyperlinks, terminal search with Ctrl+Shift+F, text zoom with Ctrl+=, Ctrl++, Ctrl+- and Ctrl+0, file drop that pastes the paths in the desktop app, Ctrl+Shift+L hint with key badges | `specs/session-view.md` |
| TerminalSearchBox | UI component | `src/web/sessions/TerminalSearchBox.tsx` | Search box at the top right of the terminal panel: field, "N of M" or "No results", previous, next and close, with Enter, Shift+Enter and Esc | `specs/terminal-search-box.md` |
| TerminalFontSizeStore | frontend service | `src/web/sessions/terminal-font-size-store.ts` | One text size for all hosted terminals: 8 to 32 px, default 12 px, larger, smaller and reset, saved in `localStorage` | `specs/terminal-font-size-store.md` |
| TerminalZoomControls | UI component | `src/web/sessions/TerminalZoomControls.tsx` | Subbar buttons "Smaller text", default size (shows "<size> px") and "Larger text", disabled at the limits | `specs/terminal-zoom-controls.md` |
| droppedPathsText | frontend function | `src/web/sessions/dropped-paths-text.ts` | Text of a drop: each path followed by one space, quoted in single quotes when it has spaces or shell-special characters | `specs/dropped-paths-text.md` |
| LinkOpener | frontend function | `src/web/sessions/link-opener.ts` | Opens an `http`/`https` address in a new tab with no opener; any other scheme does nothing | `specs/link-opener.md` |
| WebAddressLinks | frontend function | `src/web/sessions/web-address-links.ts` | Link provider of the `http`/`https` addresses in the terminal rows, with wrapped and full-row addresses joined | `specs/web-address-links.md` |
| SessionHeader | UI component | `src/web/sessions/SessionHeader.tsx` | 40 px subbar of the open session: folder name, "/", path, line chip, state pill, actions | `specs/session-header.md` |
| StopSessionButton | UI component | `src/web/sessions/StopSessionButton.tsx` | Rose "Terminate" button of the open session, with confirmation when working | `specs/stop-session-button.md` |
| HookSettings | configuration | `src/server/sessions/hook-settings.ts`, `src/server/sessions/hook-forwarder.mjs` | Claude Code settings file whose hooks post each event to the server | `specs/hook-settings.md` |
| SessionStateTracker | backend service | `src/server/sessions/session-state-tracker.ts` | State, label, last activity, waiting tool and Claude Code session id of each session, with change listeners that get the cause of each change | `specs/session-state-tracker.md` |
| HookEventRoute | REST endpoint | `src/server/sessions/hook-event-route.ts` | `POST /api/sessions/:id/hook-events`: passes a hook event to the tracker | `specs/hook-event-route.md` |
| SessionListRoute | REST endpoint | `src/server/sessions/session-list-route.ts` | `GET /api/sessions`: the hosted and external sessions with their summary | `specs/session-list-route.md` |
| SessionEventsRoute | REST endpoint (WebSocket) | `src/server/sessions/session-events-route.ts` | `GET /api/sessions/events`: pushes each session change to the pages | `specs/session-events-route.md` |
| AttentionMonitor | backend service | `src/server/sessions/attention-monitor.ts` | Events when a hosted or external session enters `needs_input` or ends a turn, or a hosted session ends without a user stop, and the list of the sessions that need input, with the time each started to wait | `specs/attention-monitor.md` |
| TurnReader | backend service | `src/server/sessions/turn-reader.ts` | Reads the end of a session transcript: Claude's final response of the last turn, and whether the user interrupted it | `specs/turn-reader.md` |
| plainExcerpt | backend function | `src/server/sessions/plain-excerpt.ts` | Markdown response to plain text of at most 100 characters | `specs/plain-excerpt.md` |
| AttentionRoute | REST endpoint (WebSocket) | `src/server/sessions/attention-route.ts` | `GET /api/attention`: the needs-input list on connect and on each change, and each new event | `specs/attention-route.md` |
| groupSessions, orderSessions | frontend function | `src/web/sessions/session-order.ts` | The four list groups in order; inside each, the given order, then latest activity first | `specs/session-order.md` |
| nextSessionOrder | frontend function | `src/web/sessions/next-session-order.ts` | New order of each group from the previous order and the current sessions | `specs/next-session-order.md` |
| SessionOrderStore | frontend service | `src/web/sessions/session-order-store.ts` | Order of the sessions inside each group, kept current, moved by the user and saved in `localStorage` | `specs/session-order-store.md` |
| LiveSessionStore | frontend service | `src/web/sessions/live-session-store.ts` | Session list in the page and its load status, loaded once and kept current by events | `specs/live-session-store.md` |
| SessionList | UI component | `src/web/sessions/SessionList.tsx` | Grouped compact session rows with status dots, the amber needs-input card with "Reply"; a click opens a session, a drag moves it inside its group | `specs/session-list.md` |
| NeedsInputCounter | UI component | `src/web/sessions/NeedsInputCounter.tsx` | Amber pill "N need input" ("1 needs input") of the list panel, hidden at zero, and the count for the rail badge | `specs/needs-input-counter.md` |
| StateBadge | UI component | `src/web/sessions/StateBadge.tsx` | State of a session as a pulsing dot, a mono name or the tinted pill, in the status colours | `specs/state-badge.md` |
| Avatar | UI component | `src/web/sessions/Avatar.tsx` | Neutral 24 px square with the folder initials, and the folder-name helpers | `specs/avatar.md` |
| RelativeTime | UI component | `src/web/sessions/RelativeTime.tsx` | "Just now", "Nm ago", `HH:MM` or date of a last activity, refreshed every 30 s | `specs/relative-time.md` |
| ProgressBar | UI component | `src/web/sessions/ProgressBar.tsx` | Thin emerald indeterminate bar of a working entry | `specs/progress-bar.md` |
