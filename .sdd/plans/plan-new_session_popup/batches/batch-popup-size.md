---
batch: popup-size
feature: New-session popup aligned to the Resume popup
closed_req: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7]
depends: []
---

# Batch popup-size — New-session popup aligned to the Resume popup

The requirements are in `.sdd/plans/plan-new_session_popup/requirements.md`, with the assumptions "One size rule", "Place", "Other dialogs" and "Test groups" of `batches.md`.

The Resume popup is `ResumeDialog` (`className="resume-dialog"`). The "New Claude Code Session" popup is `FolderChooser` (`className="folder-chooser"`). Both are the shared `Dialog` frame, which is not changed. No new component.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/styles.css` | The size rule of `.resume-dialog` (maximum width, maximum height, 56 px minimum of `.dialog-scroll`) also applies to `.folder-chooser`. Write it once, as one rule with both selectors, so the two cannot drift. Keep the values and every other `.resume-dialog` rule as they are. | REQ-1, REQ-2, REQ-3, REQ-4, REQ-7 | — |
| INT-2 | modify | `src/web/folders/FolderChooser.tsx`, `src/web/styles.css` | Check the popup at the cap with many folders. Header, path field and footer stay in view, and only the "Recent" and "Folders" area scrolls. Change only what stops that, with no change to content or behaviour. | REQ-5, REQ-6 | INT-1 |

Notes:

- REQ-3 → both popups sit in the `Dialog` backdrop, which centres the frame. INT-1 adds no position rule. The scenarios prove the place is the same.
- REQ-6, REQ-7 → no intervention changes content, actions or the Resume popup values. The tests keep the existing FolderChooser and ResumeDialog behaviour as they are.
- Tests → unit tests and `e2e/popup-size.spec.ts` (found by name, not read: extend it if it checks the Resume size). The two popups are measured in the same window sizes. Browser e2e only: no Electron test, because no desktop code changes (knowledge base `electron-e2e-separate`).
- Narrow run → the tester runs the new tests, the tests of `FolderChooser` and `ResumeDialog`, and the e2e that open them (knowledge base `narrow-batch-tests`).

## Human acceptance

### Scenario: The new-session popup has the size and place of the Resume popup

- REQ → REQ-1, REQ-2, REQ-3, REQ-5, REQ-6, REQ-7
- Given → a window of 1280 × 800 px, and many project folders in the history, so both lists need to scroll
- When → the user opens "Resume", then closes it, then opens "New Claude Code Session"
- Then → the new-session popup has the same width, the same height and the same place as the Resume popup, and its folder list scrolls inside it
- And → the Resume popup looks and works as before, and the new-session popup keeps its fields, lists and "Start Session"

### Scenario: With few folders both popups follow the same height rule

- REQ → REQ-2
- Given → a window of 1280 × 800 px, and one project folder in the history
- When → the user opens "Resume", then "New Claude Code Session"
- Then → neither popup is taller than its content needs, and neither is under 280 px high

### Scenario: The match holds in a small window and after a resize

- REQ → REQ-4, REQ-5
- Given → the "New Claude Code Session" popup is open in a window of 1280 × 800 px
- When → the user makes the window 700 × 500 px
- Then → the popup shrinks with the window, its footer stays in view, and its list scrolls inside it
- And → opening "Resume" in the same window shows a popup of the same width, height and place

### Scenario: The user still starts a session from the resized popup

- REQ → REQ-6
- Given → the "New Claude Code Session" popup is open with a "Recent" project
- When → the user chooses that project and presses "Start Session"
- Then → the popup closes and the new session opens, as it did before the change
