---
slug: new_session_popup
date: 2026-11-18
spec: .sdd/analysis/new_session_popup.md
status: validated
---

# Batches — new_session_popup

Requirements: `requirements.md`.

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [popup-size](batches/batch-popup-size.md) | New-session popup aligned to the Resume popup | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7 | — | implemented | The new-session popup has the size and place of the Resume popup |

Execution order: popup-size only.

## Assumptions and decisions

- **One size rule.** The Resume size rule is already in `src/web/styles.css`, on `.resume-dialog`. The new-session popup shares it through one rule with both selectors. This is the design the analysis leaves to the plan. The shared `Dialog` and `ResumeDialog.tsx` do not change.
- **REQ-2 as written** (gatekeeper decision, review G2). The Resume height follows its content up to a cap. So "same height" means the same height when both reach the cap, and the same rule below it. This follows the analysis assumption "same size rule".
- **Other dialogs** (gatekeeper decision, review G2). The analysis lists them only as out of scope, so no REQ covers them. As a care in INT-1, the rule is limited to `.resume-dialog` and `.folder-chooser`. The `Dialog` frame and the settings popup, the confirmations and the name dialog are not touched.
- **Place.** Both popups already sit centred in the `Dialog` backdrop. The plan adds no position rule. If a test finds a difference, INT-1 gets the fix.
- **Test groups.** Browser e2e and unit tests only. No desktop code changes, so no Electron test (knowledge base `electron-e2e-separate`).
- **Missing artifacts.** The specs `folder-chooser.md` and `resume-dialog.md` have no size section for the new-session popup. The implementer adds it to the `FolderChooser` spec.

## Departures

None.

## Coverage check

batch-popup-size:

| REQ | INT |
|-----|-----|
| REQ-1 | INT-1 |
| REQ-2 | INT-1 |
| REQ-3 | INT-1 |
| REQ-4 | INT-1 |
| REQ-5 | INT-2 |
| REQ-6 | INT-2 |
| REQ-7 | INT-1 |

- Every REQ is served by at least one INT, and every INT serves at least one REQ. There is no enabling intervention.
- Each REQ closes in popup-size, the only batch.
- REQ-3, REQ-6 and REQ-7 need no new code in their own right. INT-1 and INT-2 keep them true, and the scenarios and tests prove them.
