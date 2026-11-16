---
batch: list-polish
feature: List spacing and card metrics
closed_req: [REQ-49, REQ-50, REQ-52]
depends: [session-cards, list-cards, dark-blue]
---

# Batch list-polish

Human decision, 2026-11-16. Two fixes to the lists of batches session-cards and list-cards.

- **Scrollbar gap.** When a list scrolls, its scrollbar must not touch the entries. The gap between
  the right edge of the entries and the scrollbar equals the gap on their left. A list with no
  scrollbar keeps its current layout.
- **Card line 3.** The context percentage and the cost get a smaller text, about 10 px in place of
  10.5 px. Line 3 keeps its position, aligned with the session name. The last activity time keeps
  its size.
- **State pill in the session header.** It leaves the right group and sits on the left. Order:
  session name, state pill, line pill. The line pill shrinks and is cut with an ellipsis first. The
  actions, and the "Read-only" chip of an external session, stay on the right. The session cards do
  not change. ConversationView uses the same SessionHeader, so its header changes too.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/styles.css` | Add a shared rule for list scroll areas: when the scrollbar shows, the space between entries and scrollbar equals the left gap. | REQ-49 | — |
| INT-2 | modify | `src/web/sessions/SessionList.tsx` | The session list scroll area uses the rule of INT-1. | REQ-49 | INT-1 |
| INT-3 | modify | `src/web/folders/ProjectList.tsx`, `src/web/history/ResumeDialog.tsx`, `src/web/folders/FolderChooser.tsx`, `src/web/settings/ShortcutsSection.tsx`, `src/web/settings/SettingsDialog.tsx` | The scroll areas of these lists use the rule of INT-1. | REQ-49 | INT-1 |
| INT-4 | modify | `src/web/git/RepositoryList.tsx`, `src/web/git/ChangesTab.tsx`, `src/web/git/CommitDetail.tsx`, `src/web/git/HistoryTab.tsx`, `src/web/plan-usage/PlanUsagePopover.tsx` | The scroll areas of these lists use the rule of INT-1. | REQ-49 | INT-1 |
| INT-5 | modify | `src/web/sessions/SessionList.tsx` | Line 3: percentage and cost use a smaller mono size (about 10 px), with tabular figures as before. Position and time size do not change. | REQ-50 | — |
| INT-6 | modify | `src/web/sessions/SessionHeader.tsx` | The state pill moves from the right group to the left group, between the session name and the line pill. The line pill shrinks first; the state pill is never cut. | REQ-52 | — |

## Human acceptance

### Scenario: the scrollbar does not touch the cards

- REQ → REQ-49
- Given → more sessions than the session list can show, and a long Projects list
- When → the user looks at the session list, then at the Projects list
- Then → in both, the scrollbar sits apart from the cards, with the same gap on the right as on the left

### Scenario: the card metrics are smaller

- REQ → REQ-50
- Given → a session with context usage and a cost
- When → the user looks at its card in the session list
- Then → line 3 shows the percentage and the cost in a smaller text, in the same place as before

### Scenario: the state pill follows the session name in the header

- REQ → REQ-52
- Given → a working session with a long line text
- When → the user opens it
- Then → the header shows the session name, then the "Running" pill, then the line pill cut with "…", and the buttons stay on the right
- And → an open external session shows its state pill in the same place
