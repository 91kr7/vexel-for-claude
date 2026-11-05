# Module external

| Component | Type | Path | Responsibility | Spec |
|-----------|------|------|----------------|------|
| ExternalSessionScanner | backend service | `src/server/external/external-session-scanner.ts` | Every 2 s, lists the interactive Claude Code sessions of other terminals and notifies additions, changes and removals | `specs/external-session-scanner.md` |
| TranscriptReader | backend service | `src/server/external/transcript-reader.ts` | Finds a session transcript and turns its lines into read-only conversation items | `specs/transcript-reader.md` |
| ConversationStreamRoute | REST endpoint (WebSocket) | `src/server/external/conversation-stream-route.ts` | `GET /api/external-sessions/:id/conversation`: all items, then the new ones live | `specs/conversation-stream-route.md` |
| ConversationView | UI component | `src/web/external/ConversationView.tsx` | Read-only text view of an external session, updated live | `specs/conversation-view.md` |
| ResumeHereButton | UI component | `src/web/external/ResumeHereButton.tsx` | "Riprendi qui": warning, then resume of the external session in the client | `specs/resume-here-button.md` |
