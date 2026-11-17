---
batch: list-cards
feature: Lists aligned to the session cards
closed_req: [REQ-44, REQ-45, REQ-46, REQ-47, REQ-48]
depends: [shared-shapes, session-cards]
---

# Batch list-cards

Human decision, 2026-11-16: the mock shows only the first page, so every other list takes the look of
the session cards of batch session-cards. That look is the reference here:
- card → 7 px corners, 1 px border, "card" role surface.
- active or selected → accent border, 3.5 px accent bar on the left edge, "active card" surface,
  soft shadow.
- hover → the hover surface and border of an inactive session card.
- numbers → mono font with tabular figures.

Two kinds of list:
- **card lists** (selectable entries) → each entry is a card.
- **dense lists** (technical rows) → rows keep their height and are not cards. They take the card
  surfaces, borders, corners, hover and selected style.

Batch shared-shapes (INT-9) gave project rows and past-session rows the card corners, border and
surface. This batch adds the hover, active and number parts, so they match the final session cards.
In the Windows 11 look, the lists keep that look's own corners.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/styles.css` | Add shared list classes for card entries, dense rows, hover, active/selected and tabular numbers. Their values are the session card values. | REQ-44, REQ-45, REQ-46, REQ-47, REQ-48 | — |
| INT-2 | modify | `src/web/folders/ProjectList.tsx` | Card list: project rows take the card, hover and focus styles; the last activity time uses tabular figures. | REQ-44, REQ-46, REQ-48 | INT-1 |
| INT-3 | modify | `src/web/history/ResumeDialog.tsx` | Card list: past-session rows, search results included, are cards; the checked row has the active look. | REQ-44, REQ-45, REQ-46, REQ-48 | INT-1 |
| INT-4 | modify | `src/web/folders/FolderChooser.tsx` | Card list: "Recent" folders are cards; the chosen one has the active look. | REQ-44, REQ-45, REQ-46 | INT-1 |
| INT-5 | modify | `src/web/folders/FolderChooser.tsx` | Dense list: the folder browser rows take the dense row style. | REQ-47 | INT-1 |
| INT-6 | modify | `src/web/git/RepositoryList.tsx` | Card list: repository entries are cards; a chosen filter entry has the active look. | REQ-44, REQ-45, REQ-46 | INT-1 |
| INT-7 | modify | `src/web/git/ChangesTab.tsx` | Dense list: file rows take the dense row style; the selected file has the selected style. | REQ-47 | INT-1 |
| INT-8 | modify | `src/web/git/CommitDetail.tsx` | Dense list: changed files of a commit, as in INT-7. | REQ-47 | INT-1 |
| INT-9 | modify | `src/web/git/HistoryTab.tsx` | Dense list: commit rows keep their 28 px height and take hover and selected style. Short hash and date use tabular figures. | REQ-47, REQ-48 | INT-1 |
| INT-10 | modify | `src/web/settings/ShortcutsSection.tsx` | Dense list: shortcut rows take the dense row style and hover. | REQ-47 | INT-1 |
| INT-11 | modify | `src/web/settings/SettingsDialog.tsx` | Dense list: the menu items take the dense row style; the chosen item has the selected style. | REQ-47 | INT-1 |
| INT-12 | modify | `src/web/plan-usage/PlanLimitRow.tsx` | Dense list: limit rows take the dense row style; percentages and times use tabular figures. | REQ-47, REQ-48 | INT-1 |

## Human acceptance

### Scenario: the Resume dialog shows its sessions as cards

- REQ → REQ-44, REQ-45, REQ-46, REQ-48
- Given → the client in the Dark theme, with past sessions
- When → the user opens "Resume", types a search, and selects one result with the arrow keys
- Then → each result is a card like a session card, the selected one has the accent border and bar, and a hovered card changes its surface and border
- And → the Projects list, the "Recent" folders and the repository list show the same cards

### Scenario: technical lists share the card style

- REQ → REQ-47, REQ-48
- Given → a session open in a git repository with changes and commits
- When → the user opens the Git Explorer, selects a changed file, then opens "History"
- Then → file rows and commit rows keep their compact height, with the card surfaces, borders, hover and selected style, and numbers in tabular figures
- And → the shortcut rows and the menu of Settings, and the rows of Plan Usage, show the same style
