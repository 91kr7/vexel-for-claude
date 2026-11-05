# Module sessions

| Component | Type | Path | Responsibility | Spec |
|-----------|------|------|----------------|------|
| SessionRegistry | backend service | `src/server/sessions/session-registry.ts` | Spawns the CLI in a pty and keeps each session by id, with its viewers | `specs/session-registry.md` |
| TerminalMirror | backend service | `src/server/sessions/terminal-mirror.ts` | Headless terminal of a session that gives a serialized snapshot | `specs/terminal-mirror.md` |
| StartSessionRoute | REST endpoint | `src/server/sessions/start-session-route.ts` | `POST /api/sessions`: starts a session in an existing folder | `specs/start-session-route.md` |
| AttachSessionRoute | REST endpoint (WebSocket) | `src/server/sessions/attach-session-route.ts` | `GET /api/sessions/:id/attach`: snapshot, live output, input and resize | `specs/attach-session-route.md` |
| SessionView | UI component | `src/web/sessions/SessionView.tsx` | xterm.js terminal attached to a session, with "Interrompi" | `specs/session-view.md` |
