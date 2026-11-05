---
batch: session-list
feature: Session list
closed_req: [REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16]
depends: [layout]
---

# Batch — Session list

The entries of the list, readable at a glance, with "needs input" first in the eye as well as in the order.

Constraint → every requirement of `plan-claude_sessions_client` stays true (`requirements.md`, "Constraints on every batch"). The order (needs input first, then latest activity) does not change.

## What this batch builds

- **State badge** → the state of a session as colour, icon and Italian name together. Batch `open-session` reuses it in the session header.

## Decisions for this batch

- **Emphasis order** → "Richiede input" is the strongest. The open entry comes second. An open entry in "Richiede input" shows both.
- **External mark** → the existing "Esterna" text, with an icon. Its tooltip does not change.
- **State names** → "In lavorazione", "Richiede input", "In attesa", "Terminata", as today.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | frontend, sessions area | State badge: the icon, colour and Italian name of one session state, from the theme tokens. | REQ-12, REQ-1, REQ-3 | — |
| INT-2 | modify | `src/web/sessions/SessionList.tsx` | Each entry: label and State badge on the first line, folder and last activity on the second, always in the same place. Long label and folder are cut with an ellipsis, and the tooltip shows the full value. | REQ-11, REQ-12 | INT-1 |
| INT-3 | modify | `src/web/sessions/SessionList.tsx` | "Richiede input" entries get the strongest emphasis of the list, stronger than the open-entry highlight. | REQ-13 | INT-2 |
| INT-4 | modify | `src/web/sessions/SessionList.tsx` | The open entry gets its own highlight, which no other entry has. It keeps `aria-current`. | REQ-16 | INT-2 |
| INT-5 | modify | `src/web/sessions/SessionList.tsx` | External entries show an icon next to "Esterna". The tooltip stays. | REQ-15 | INT-2 |
| INT-6 | modify | `src/web/sessions/NeedsInputCounter.tsx` | New look: with N > 0 it uses the needs-input colour and icon of INT-1, with N = 0 a neutral look. | REQ-14 | INT-1 |

## Human acceptance

### Scenario: The user spots the session that needs input

- REQ → REQ-12, REQ-13, REQ-14
- Given → three hosted sessions run, one of them is open in the main area
- When → Claude asks for a permission in a session that is not open
- Then → its entry shows "Richiede input" with its colour and icon, and it stands out more than every other entry, the open one included
- And → the counter at the top of the sidebar shows 1 session in "Richiede input", while the other session stays open in the main area

### Scenario: The user tells the entries apart at a glance

- REQ → REQ-11, REQ-14, REQ-15, REQ-16
- Given → a hosted session is open and an external session runs in a terminal
- When → the user looks at the list
- Then → each entry shows label, folder, state and last activity in the same places, and only the open entry is highlighted
- And → the external entry carries the "Esterna" mark with its icon, and the counter is visible above the list
