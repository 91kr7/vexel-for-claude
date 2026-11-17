---
batch: popup-size
feature: Popup size
closed_req: [REQ-1, REQ-2, REQ-3, REQ-4]
depends: []
---

# Batch popup-size — Popup size

REQ ids refer to `plan-resume_favorites/requirements.md`. "Resume popup" is defined there. It is the ResumeDialog of module history.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/history/ResumeDialog.tsx` | Give the frame its own class (Dialog `className`) and its rule in the page styles. Width about 1.5 times the Dialog default of 448 px, so about 672 px. Never wider than the backdrop. | REQ-1, REQ-4 | — |
| INT-2 | modify | `src/web/history/ResumeDialog.tsx` | The same class caps the frame height clearly below the window height, also when there are many sessions. The search bar, the header and the footer stay visible. Only the "Past Sessions" area scrolls. | REQ-2, REQ-3, REQ-4 | INT-1 |

## Decisions

- **Only this dialog.** Dialog (module app) does not change. The other dialogs keep 448 px (out of scope in the spec).
- **Exact values (implementer's choice inside these limits).**
  - Width → about 672 px, at most the backdrop width.
  - Height cap → about 70 % of the window height. Below that cap the frame follows its content, as today.
  - Small window → the backdrop padding of 16 px stays. The frame shrinks with the window, and the list area keeps at least room for one row.
- **Scrolling.** The list area keeps the ListStyles `.list-scroll` rule of the spec of ResumeDialog. Only this area scrolls.
- **Tests (knowledge base `electron-e2e-separate`).** Playwright e2e in the browser: the frame width against the 448 px of another dialog, the height against the window with many fixture sessions, the scroll of the list, and a small viewport. No Electron e2e: no desktop file changes.

## Human acceptance

### Scenario: The resume popup is wider and shorter

- REQ → REQ-1, REQ-2, REQ-3
- Given → the machine has more past sessions than fit in the popup
- When → the user opens "Resume Session"
- Then → the popup is about 1.5 times as wide as "New Session", leaves clear space above and below it, and the list scrolls inside it
- And → the search bar and the "Cancel" and "Resume" buttons stay in view while the list scrolls

### Scenario: The popup fits a small window

- REQ → REQ-4
- Given → the window is small, narrower and lower than the popup
- When → the user opens "Resume Session"
- Then → the whole popup is in view, and the user can search, choose a row and press "Resume"
