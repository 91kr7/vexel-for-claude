---
module: external
component: ConversationView
type: UI component
---

# ConversationView

**Purpose** → shows the conversation of an external session as text, read-only, and keeps it current.

## Contract

Description:
- a SessionHeader above a scrolling list of the conversation items. It fills the open-session area.
- on wide screens the items sit in a centred column of readable width. The list scrolls across the whole width.

Props:
- `sessionId` → the id of the external session.
- `session` → `{ folder, label, state }` for the header. Optional.
- `onResumed(id)` → called with the id of the hosted session after "Riprendi qui" succeeds.

Shows:
- the SessionHeader with `session`, the action "Riprendi qui" (ResumeHereButton) and the notice "Sola lettura" with a lock icon.
- before the first frame of ConversationStreamRoute → "Caricamento…".
- first frame with no items → "Nessun messaggio."
- one `article` per item, in the order received. Each kind has its own look:
  - `user` → heading "Utente" and the text, in a tinted box.
  - `assistant` → heading "Claude" and the text, with no box.
  - `tool_call` → one line in a bordered box: wrench icon, heading "Strumento: <name>", the summary cut with an ellipsis.
  - `tool_result` → heading "Risultato" and the text as preformatted lines, in a bordered box under its call. When `truncated`, a last line "…".
- the socket closes before the first frame → "Conversazione non disponibile."

Actions:
- each new frame adds its items at the end.
- "Espandi" (`aria-expanded="false"`) → on every `tool_call` with a `ref`, and on every `tool_result` with `truncated` and a `ref`.
  - first expand → loads the full content from ItemContentRoute. While it loads, "Caricamento…" shows in the item.
  - loaded → `tool_call`: the full input as preformatted text under its line. `tool_result`: the full text in place of the 5 lines and "…".
  - the load fails → "Impossibile caricare il contenuto completo." in the item. The next expand tries again.
  - the button becomes "Comprimi" (`aria-expanded="true"`). It hides the full content and shows the collapsed item again.
  - later expands show the loaded content again with no new request.

Scrolling:
- the view is at the end when its bottom is within 8 px of the end of the list.
- new items arrive while the view is at the end → the list scrolls to the last item.
- new items arrive while the user has scrolled up → the view does not move.
- the first frame always shows the last item.

## Rules and invariants

- It has no input field. It sends nothing on the socket.
- It opens one socket per `sessionId` and closes it on unmount.
- The header and its notice stay in place. Only the list scrolls.
- It requests the full content of an item only when the user expands it.

## Dependencies

- ConversationStreamRoute, ItemContentRoute, ResumeHereButton
- SessionHeader (module sessions)
- IconSet (module app)

## Requirements served

- `plan-claude_sessions_client/REQ-33`, `plan-claude_sessions_client/REQ-34`, `plan-claude_sessions_client/REQ-36`
- `plan-claude_sessions_client-ui_redesign/REQ-17`, `plan-claude_sessions_client-ui_redesign/REQ-19`, `plan-claude_sessions_client-ui_redesign/REQ-20`, `plan-claude_sessions_client-ui_redesign/REQ-21`, `plan-claude_sessions_client-ui_redesign/REQ-22`, `plan-claude_sessions_client-ui_redesign/REQ-23`, `plan-claude_sessions_client-ui_redesign/REQ-24`, `plan-claude_sessions_client-ui_redesign/REQ-4`
