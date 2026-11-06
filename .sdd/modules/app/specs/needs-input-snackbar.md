---
module: app
component: NeedsInputSnackbar
type: UI component
---

# NeedsInputSnackbar

**Purpose** → an in-page alert when a session that is not open starts to need input, with "Apri" to open it. It copies `#toast-pill` of `.sdd/mockups/studio-dark/mock.html`.

## Contract

`nextSnackbarSession(previousStates, sessions, shownId, openSessionId) → string | null` → the id of the session the snackbar shows after a list change.
- `previousStates` → the state of each session id in the list before the change.
- a session "starts to need input" → its state is `needs_input`, and before the change it was another state or it was not in the list.
- result:

```
starting = sessions that start to need input, except openSessionId
if starting is not empty → the one with the latest lastActivity
else if shownId is in sessions, in needs_input, and is not openSessionId → shownId
else → null
```

`useNeedsInputSnackbar(sessions, status, openSessionId) → SessionSummary | undefined` → the session the snackbar shows now.
- the list held when `status` first becomes `ready` is the baseline: sessions that already need input then give no snackbar.
- from then on, each list change or open-session change applies `nextSnackbarSession`.
- it never returns the open session, nor a session that no longer needs input or left the list. Once hidden, a session shows again only when it starts to need input again.

`NeedsInputSnackbar` props:
- `session` → the session to show.
- `onOpen(sessionId)` → called by "Apri".

Shows:
- a `role="status"` `.vx-glass` box, fixed 20 px from the right and bottom edges of the window, above the page (z-index 50) and below the dialogs. Padding 8 × 14 px, 8 px radius, mono 12/16 px in `--text-primary`, 12 px gap.
- the text "<progetto> richiede il tuo input". "<progetto>" is the last segment of the session folder, in bold (mono 500).
- the button "Apri" → a text button, mono 12 px weight 500, `--accent-primary`, underlined on hover.

Actions:
- "Apri" → `onOpen(session.id)`.

## Rules and invariants

- One snackbar at a time. A newer session that starts to need input replaces the one shown.
- The box is never wider than the window minus 40 px. A long folder name wraps.
- It may cover the corner of the terminal. The terminal does not resize for it.

## Dependencies

- LiveSessionStore (module sessions): `SessionSummary`, `LoadStatus`
- WebEntry (`.vx-glass`)

## Requirements served

- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-13`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-15`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-41`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-42`
