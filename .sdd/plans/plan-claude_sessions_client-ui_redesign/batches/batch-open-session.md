---
batch: open-session
feature: Open session
closed_req: [REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24]
depends: [session-list]
---

# Batch — Open session

The main area when a session is open: a header with the session and its actions, then the terminal of a hosted session or the read-only conversation of an external one.

Constraint → every requirement of `plan-claude_sessions_client` stays true (`requirements.md`, "Constraints on every batch"). This includes slash commands, "Interrompi", permission answers and the live update of the external view.

## What this batch builds

- **Session header** → the folder, label and state of the open session, with its actions.
- **Item content route** → gives the page the full content of one tool call or tool result of an external session, when the user expands it.

## Decisions for this batch

- **Header actions** → hosted session: "Interrompi" and "Termina". External session: "Riprendi qui".
- **Read-only notice** → icon and the text "Sola lettura", in the header area. It does not scroll with the conversation.
- **Collapsed items** → a tool call shows as one line: icon, tool name and the existing one-line summary. A tool result longer than 5 lines shows the first 5 lines, as today. Expanded, both show their full content.
- **Full content on demand** (gatekeeper decision) → the stream keeps sending the short items it sends today. The full content of an item loads only on its first expand. Reason → REQ-24: a transcript with large outputs must still open within one second.
- **"At the end"** → the view counts as at the end when its bottom is within a few pixels of the last item.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | frontend, sessions area | Session header: folder, label and State badge (batch `session-list`) of the open session, with a place for its actions. Long text is cut with an ellipsis. | REQ-17, REQ-1 | — |
| INT-2 | modify | `src/web/AppLayout.tsx` | Pass the summary of the open session (folder, label, state) to SessionView and ConversationView. For an external session, keep the last known summary after its entry leaves the list. | REQ-17 | — |
| INT-3 | modify | `src/web/sessions/SessionView.tsx` | Replace the toolbar with the Session header, with "Interrompi" and "Termina" as its actions. The terminal fills the whole area below the header. | REQ-17, REQ-18, REQ-24 | INT-1, INT-2 |
| INT-4 | modify | `src/web/external/ConversationView.tsx` | Replace the toolbar with the Session header, with "Riprendi qui" as its action. Add the read-only notice. | REQ-17, REQ-19 | INT-1, INT-2 |
| INT-5 | modify | `src/web/external/ConversationView.tsx` | Give each item kind its own look: user message, Claude message, tool call with its result. On wide screens, limit the text column to a readable width. | REQ-20 | INT-4 |
| INT-6 | modify | `src/server/external/transcript-reader.ts` | Each `tool_call` and `tool_result` item also carries a reference to its source: the byte offset of its line and the index of its block. | REQ-21 | — |
| INT-7 | modify | `src/server/external/transcript-reader.ts` | New read of one referenced item: the full tool input as indented JSON, or the full result text. It stays read-only. | REQ-21 | INT-6 |
| INT-8 | create | backend, external area | Item content route: a read-only HTTP `GET` under `/api/external-sessions/` that returns the INT-7 full content of one item, by session id and reference. | REQ-21 | INT-7 |
| INT-9 | modify | `src/server/main.ts` | Register the INT-8 route. | REQ-21 | INT-8 |
| INT-10 | modify | `src/web/external/ConversationView.tsx` | Show tool calls, and tool results with `truncated`, collapsed. An expand button loads the full content from INT-8 the first time, and a collapse button hides it again. | REQ-21, REQ-24, REQ-4 | INT-5, INT-8 |
| INT-11 | modify | `src/web/external/ConversationView.tsx` | Scroll to new items only when the view is at the end. When the user has scrolled up, new items do not move the view. | REQ-22, REQ-23 | INT-5 |

## Human acceptance

### Scenario: The user works in a hosted session under its header

- REQ → REQ-17, REQ-18, REQ-24
- Given → 10 sessions are active
- When → the user opens a hosted session from the list
- Then → within one second the header shows its folder, label and state, with "Interrompi" and "Termina"
- And → the terminal fills the whole main area below the header

### Scenario: The user reads an external session

- REQ → REQ-17, REQ-19, REQ-20
- Given → an external session has user messages, Claude messages and tool calls
- When → the user opens it from the list
- Then → the header shows its folder, label and state with "Riprendi qui", and a "Sola lettura" notice that stays in view while the user scrolls
- And → user messages, Claude messages and tool calls each have their own look

### Scenario: The user expands a long tool output

- REQ → REQ-21
- Given → an open external session shows, collapsed, a tool output longer than 5 lines
- When → the user expands it
- Then → the full output shows, and a collapse button hides it again

### Scenario: The user reads earlier content while the session runs

- REQ → REQ-22, REQ-23
- Given → the user has scrolled up to earlier content of an external session that runs
- When → Claude writes a new message in the terminal
- Then → the view does not move
- And → after the user scrolls back to the end, the next new message comes into view by itself
