# Module sessions

| Component | Type | Path | Responsibility | Spec |
|-----------|------|------|----------------|------|
| SessionRegistry | backend service | `src/server/sessions/session-registry.ts` | Spawns the CLI in a pty (new or `--resume`) with the hook settings and keeps each session by id, with its viewers and pids | `specs/session-registry.md` |
| TerminalMirror | backend service | `src/server/sessions/terminal-mirror.ts` | Headless terminal of a session that gives a serialized snapshot | `specs/terminal-mirror.md` |
| StartSessionRoute | REST endpoint | `src/server/sessions/start-session-route.ts` | `POST /api/sessions`: starts a session in an existing folder | `specs/start-session-route.md` |
| StopSessionRoute | REST endpoint | `src/server/sessions/stop-session-route.ts` | `POST /api/sessions/:id/stop`: stops the CLI process, SIGTERM then SIGKILL | `specs/stop-session-route.md` |
| AttachSessionRoute | REST endpoint (WebSocket) | `src/server/sessions/attach-session-route.ts` | `GET /api/sessions/:id/attach`: snapshot, live output, input and resize | `specs/attach-session-route.md` |
| SessionView | UI component | `src/web/sessions/SessionView.tsx` | SessionHeader with "Interrompi", "Termina" and the Ctrl+Shift+L hint above the xterm.js terminal attached to a session | `specs/session-view.md` |
| SessionHeader | UI component | `src/web/sessions/SessionHeader.tsx` | Bar above the open session: label, state, folder and its actions | `specs/session-header.md` |
| StopSessionButton | UI component | `src/web/sessions/StopSessionButton.tsx` | "Termina" button of the open session, with confirmation when working | `specs/stop-session-button.md` |
| HookSettings | configuration | `src/server/sessions/hook-settings.ts`, `src/server/sessions/hook-forwarder.mjs` | Claude Code settings file whose hooks post each event to the server | `specs/hook-settings.md` |
| SessionStateTracker | backend service | `src/server/sessions/session-state-tracker.ts` | State, label, last activity, waiting tool and Claude Code session id of each session, with change listeners | `specs/session-state-tracker.md` |
| HookEventRoute | REST endpoint | `src/server/sessions/hook-event-route.ts` | `POST /api/sessions/:id/hook-events`: passes a hook event to the tracker | `specs/hook-event-route.md` |
| SessionListRoute | REST endpoint | `src/server/sessions/session-list-route.ts` | `GET /api/sessions`: the hosted and external sessions with their summary | `specs/session-list-route.md` |
| SessionEventsRoute | REST endpoint (WebSocket) | `src/server/sessions/session-events-route.ts` | `GET /api/sessions/events`: pushes each session change to the pages | `specs/session-events-route.md` |
| groupSessions, orderSessions | frontend function | `src/web/sessions/session-order.ts` | The four list groups in order, latest activity first inside each | `specs/session-order.md` |
| LiveSessionStore | frontend service | `src/web/sessions/live-session-store.ts` | Session list in the page and its load status, loaded once and kept current by events | `specs/live-session-store.md` |
| SessionList | UI component | `src/web/sessions/SessionList.tsx` | Grouped session entries as the board variants, the amber needs-input card with "Rispondi"; a click opens a session | `specs/session-list.md` |
| NeedsInputCounter | UI component | `src/web/sessions/NeedsInputCounter.tsx` | Amber chip "N richiede input" of the list panel, hidden at zero, and the count for the rail badge | `specs/needs-input-counter.md` |
| StateBadge | UI component | `src/web/sessions/StateBadge.tsx` | Icon and Italian name of a session state, in the board colours | `specs/state-badge.md` |
| Avatar | UI component | `src/web/sessions/Avatar.tsx` | Project badge: initials on a stable colour and shape, amber, grey or outlined terminal; three sizes | `specs/avatar.md` |
| RelativeTime | UI component | `src/web/sessions/RelativeTime.tsx` | "ora", "N min fa", `HH:MM` or date of a last activity, refreshed every 30 s | `specs/relative-time.md` |
| ProgressBar | UI component | `src/web/sessions/ProgressBar.tsx` | Thin animated indeterminate bar of a working entry | `specs/progress-bar.md` |
