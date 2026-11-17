---
batch: project-path
feature: Project path while scrolling
closed_req: [REQ-20, REQ-21]
depends: [popup-size, favorites-filter]
---

# Batch project-path — Project path while scrolling

REQ ids refer to `plan-resume_favorites/requirements.md`. "Resume popup" is defined there. It is the ResumeDialog of module history. Its spec is `.sdd/modules/history/specs/resume-dialog.md`. Today each group of past sessions has a heading with the full folder path. That heading scrolls away with the rows.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/history/ResumeDialog.tsx` | The folder heading of each group sticks to the top of the past sessions area while the rows of its group scroll. The next group's heading takes its place. The heading has an opaque background, so the rows pass under it. | REQ-20 | — |
| INT-2 | modify | `src/web/history/ResumeDialog.tsx` | A folder path that does not fit shows on one line with an ellipsis. The last folders of the path stay visible. The full path is the tooltip of the heading and stays the accessible name of the section. | REQ-21 | INT-1 |

## Decisions

- **Only this dialog.** The new rules sit under the frame class that `batch-popup-size` gave the dialog. FolderChooser and the shared `.section-label-path` look do not change (other dialogs are out of scope in the spec).
- **One line, end visible.** A wrapping heading that sticks can cover several rows in a narrow window. So the heading stays on one line. The ellipsis cuts the start of the path, because the last folders name the project. The exact look is the implementer's choice.
- **Search and filter.** The headings follow the visible groups. So the rule works the same with the search or the favorites filter on. No change to the filter logic.
- **Spec.** The implementer updates the "Shows" part of the ResumeDialog spec about the heading.
- **Tests (knowledge base `electron-e2e-separate`).** Playwright e2e in the browser. Fixture with two projects, enough sessions to scroll, and one long folder path. Checks: the heading stays at the top of the list during the scroll, it changes at the second group, it stays on one line, and its tooltip holds the full path. Also with search text and with the filter on. No Electron e2e: no desktop file changes.

## Human acceptance

### Scenario: The project path stays visible while the list scrolls

- REQ → REQ-20, REQ-21
- Given → the machine has many past sessions in two projects, and one project has a long folder path
- When → the user opens "Resume Session" and scrolls the list
- Then → the path of the project of the first rows in view stays at the top of the list, and it changes when the rows of the other project reach the top
- And → the long path stays on one line with its last folders visible, and pointing at it shows the full path
