---
batch: layout
feature: Layout
closed_req: [REQ-8, REQ-9, REQ-10]
depends: [visual-language]
---

# Batch — Layout

The page as a sidebar with the session list, next to a main area with the open session or an empty state.

Constraint → every requirement of `plan-claude_sessions_client` stays true (`requirements.md`, "Constraints on every batch").

## What this batch builds

- **Empty state** → what the main area shows when no session is open, with the actions to start or resume one.

## Decisions for this batch

- **Sidebar** → title, needs-input counter, "Nuova sessione", "Riprendi sessione", then the list. The top part stays in place. Only the list scrolls. The page has no separate header bar.
- **Widths** → the sidebar has a fixed width. The main area takes the rest. Long text is cut with an ellipsis, never pushed out of the window.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/AppLayout.tsx` | Two columns: a sidebar with the title, NeedsInputCounter, "Nuova sessione", "Riprendi sessione" and SessionList, and the main area. The top of the sidebar stays in place while the list scrolls. | REQ-8, REQ-14 | — |
| INT-2 | modify | `src/web/styles.css` | Layout grid: fixed-width sidebar and flexible main area. They fill the window from 1280 px to 3840 px wide, with no horizontal scroll. | REQ-8, REQ-10 | INT-1 |
| INT-3 | create | frontend, app area | Empty state: an icon, a short text and the buttons "Nuova sessione" and "Riprendi sessione". The buttons open the same dialogs as the sidebar buttons. | REQ-9, REQ-1, REQ-4 | — |
| INT-4 | modify | `src/web/AppLayout.tsx` | Show the INT-3 empty state in the main area, in place of "Nessuna sessione aperta.". | REQ-9 | INT-1, INT-3 |

## Human acceptance

### Scenario: The user sees the list and the open session side by side

- REQ → REQ-8, REQ-10
- Given → two sessions run and the window is 1280 px wide
- When → the user opens one of them
- Then → the list stays on the left and the session fills the area on the right, with no horizontal scroll
- And → at 3840 px wide the page also has no horizontal scroll and no overlapping elements

### Scenario: The user finds the actions in the empty page

- REQ → REQ-9
- Given → no session is open
- When → the user opens the client
- Then → the main area shows the empty state with "Nuova sessione" and "Riprendi sessione"
- And → "Nuova sessione" there opens the folder chooser
