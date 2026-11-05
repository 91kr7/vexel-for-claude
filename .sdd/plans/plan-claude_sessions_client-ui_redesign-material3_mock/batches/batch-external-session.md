---
batch: external-session
feature: External session
closed_req: [REQ-35, REQ-36, REQ-37, REQ-38, REQ-39, REQ-40, REQ-41, REQ-42, REQ-43]
depends: [hosted-session]
---

# Batch — External session

The read-only view of a session that runs in another terminal: its header, the messages, the tool cards and the "N nuovi messaggi" button.

Constraint → every requirement of `plan-claude_sessions_client` and `plan-claude_sessions_client-ui_redesign` stays true. This includes live updates, "Riprendi qui" with its warning, the full content loaded only on the first expand, the view that follows new content at the end, and the view that stays still while the user reads earlier content.

## Visual reference

Board file → `.sdd/mockups/vexel-material3/proposta-sessione-esterna.html`, inside `main`:
- the header → outlined terminal avatar, `h2`, state chip, chip "Sola lettura", line "Aperta in un altro terminale · …", filled "Riprendi qui".
- the rounded content panel and its 760 px column → user bubble, Claude message with the ember spark, inline code chip, open tool card, closed tool cards.
- the button at the bottom centre → "N nuovi messaggi".

Texts such as "1 fallito" and "14 superati" on the chips are sample data. The real texts are "Fatto" and "Fallito".

## What this batch builds

- No new component. It redraws the external view and gives the transcript items the data the cards need.
- To the developer: the result must be IDENTICAL to the mock board — open the board file and copy its layout, sizes, radii, spacing, typography, icons and texts; a description is not a substitute. Board: `proposta-sessione-esterna.html`.

## Decisions for this batch

- **Header** → the SessionHeader of batch `hosted-session`, with the outlined terminal Avatar, the chip "Sola lettura" (lock icon) and the line "Aperta in un altro terminale · <folder path>". It stays in place while the content scrolls.
- **User bubble time** → `HH:MM`, with the date before it on earlier days. It comes from the `timestamp` of the transcript line.
- **Inline code** → text between single backticks in a Claude message becomes a mono chip. The rest of the text stays plain.
- **Tool card** → a `tool_call` and the `tool_result` with the same tool-use id form one card. Icon: Bash → terminal, Edit, Write, MultiEdit and NotebookEdit → pencil, any other tool → wrench. The main argument is today's summary.
- **Open card** → the output in mono. A cut output loads its full text on the first open, as today. When the input has more than the main argument, the full input shows above the output in the same mono block. So no content becomes unreachable.
- **Outcome chip** (gatekeeper decision) → green "Fatto" with a check icon when the result is not an error. Red "Fallito" with the circle-x icon when `is_error` is true. No chip before the result arrives.
- **"N nuovi messaggi"** → N counts the items that arrived while the user read earlier content. A tool card counts as one. A click scrolls to the end and hides the button. The button also hides when the user scrolls to the end.
- **Spark** → the ember four-point star of the board. It is mock artwork, not a Lucide icon.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/server/external/transcript-reader.ts` | User items carry the `timestamp` of their line. `tool_call` items carry their tool-use id. `tool_result` items carry their `tool_use_id` and `is_error`. | REQ-36, REQ-40 | — |
| INT-2 | modify | `src/web/external/ConversationView.tsx` | Header as the board: outlined terminal Avatar, folder name, state chip, chip "Sola lettura", line "Aperta in un altro terminale · <folder>". IDENTICAL to the board header. | REQ-35, REQ-43 | — |
| INT-3 | modify | `src/web/external/ResumeHereButton.tsx` | "Riprendi qui" as the filled primary board button, with its icon. Busy and error states stay. | REQ-35, REQ-43 | — |
| INT-4 | modify | `src/web/external/ConversationView.tsx` | Rounded content panel with the 760 px column. User message as a right bubble in `--primary` with its time. Claude message on the left with the ember spark. IDENTICAL to the board. | REQ-36, REQ-37, REQ-43 | INT-1, INT-10 |
| INT-5 | modify | `src/web/external/ConversationView.tsx` | Inline code in Claude messages as the board mono chip. | REQ-38, REQ-43 | INT-4 |
| INT-6 | modify | `src/web/external/ConversationView.tsx` | Join each tool call with its result into one collapsible card: tool icon, name, main argument in mono, chevron. Closed by default. IDENTICAL to the board cards. | REQ-39, REQ-43 | INT-1, INT-10 |
| INT-7 | modify | `src/web/external/ConversationView.tsx` | The open card shows the output in mono, loaded in full on the first open when cut, and the full input above it when it has more than the main argument. | REQ-39, REQ-43 | INT-6 |
| INT-8 | modify | `src/web/external/ConversationView.tsx` | Outcome chip in the card: green "Fatto" or red "Fallito", none before the result. IDENTICAL to the board chips. | REQ-40, REQ-43 | INT-1, INT-6 |
| INT-9 | modify | `src/web/external/ConversationView.tsx` | "N nuovi messaggi" button at the bottom centre of the panel, while new items wait below. A click scrolls to the end. IDENTICAL to the board button. | REQ-41, REQ-42, REQ-43 | INT-4 |
| INT-10 | modify | `src/web/icons/Icons.tsx` | Add the spark, pencil, check and arrow-down icons, with the paths copied from the board. | REQ-37, REQ-39, REQ-40, REQ-41 | — |

## Human acceptance

### Scenario: The user reads an external session laid out as the board

- REQ → REQ-35, REQ-36, REQ-37, REQ-38, REQ-39, REQ-40, REQ-43
- Given → a 1440 x 900 px window and an external session with the sample data of board "Sessione esterna"
- When → the user opens the session
- Then → the page matches the board in both themes, except for the light-blue and grey palette and the chip texts "Fatto" and "Fallito"
- And → a click on a closed tool card opens it and shows its output in mono

### Scenario: The user jumps to new messages

- REQ → REQ-41, REQ-42
- Given → an open external session, scrolled up to earlier content, and two new messages arrive
- When → the user clicks "2 nuovi messaggi"
- Then → the view scrolls to the last message and the button disappears
