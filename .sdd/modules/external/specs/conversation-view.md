---
module: external
component: ConversationView
type: UI component
---

# ConversationView

**Purpose** → shows the conversation of an external session as text, read-only, and keeps it current.

## Contract

Description:
- a toolbar with "Riprendi qui" (ResumeHereButton) above a scrolling list of the conversation items. It fills the open-session area.

Props:
- `sessionId` → the id of the external session.
- `onResumed(id)` → called with the id of the hosted session after "Riprendi qui" succeeds.

Shows:
- before the first frame of ConversationStreamRoute → "Caricamento…".
- first frame with no items → "Nessun messaggio."
- one block per item, in the order received:
  - `user` → heading "Utente" and the text.
  - `assistant` → heading "Claude" and the text.
  - `tool_call` → heading "Strumento: <name>" and the summary.
  - `tool_result` → heading "Risultato" and the text as preformatted lines. When `truncated`, a last line "…".
- the socket closes before the first frame → "Conversazione non disponibile."

Actions:
- each new frame adds its items at the end. The list then scrolls to the latest item.

## Rules and invariants

- It has no input field. It sends nothing on the socket.
- It opens one socket per `sessionId` and closes it on unmount.

## Dependencies

- ConversationStreamRoute, ResumeHereButton

## Requirements served

- `plan-claude_sessions_client/REQ-33`, `plan-claude_sessions_client/REQ-34`, `plan-claude_sessions_client/REQ-36`
