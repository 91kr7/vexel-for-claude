---
batch: batch-graph-history
feature: Graph history
closed_req: REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19
depends: batch-open-source-explorer
---

# Batch — Graph history

Requirements: `../requirements.md`. Paths of the module `git` are in `.sdd/modules/git/index.md`.

This batch replaces the plain commit list of the History tab with a commit graph, drawn by an open-source component. It also closes the requirements that cover the whole git explorer: regression, theme, desktop window and licences.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/server/git/log-parser.ts` | Add the parent hashes to `LOG_FORMAT` and a `parents` list to `Commit`. A root commit has an empty list. Cover both in its unit test. | REQ-9, REQ-10 | — |
| INT-2 | modify | `src/server/git/history-lookup.ts` | List the commits with `--date-order`. Keep the pages of 100 and the empty history of a repository with no commits. | REQ-8, REQ-9, REQ-17 | INT-1 |
| INT-3 | modify | `package.json` | Add an open-source commit graph component as a runtime dependency. It must pass the rules of "Choosing the graph component" below. | REQ-6, REQ-8 | — |
| INT-4 | modify | `src/web/git/HistoryTab.tsx` | Show the commits with the graph component: one row per commit, newest first, the graph column, then short hash, subject, author and date. Keep "Load more", "No commits yet", the commit detail and the refresh rules. Style it from the theme tokens. | REQ-3, REQ-4, REQ-8, REQ-13, REQ-17, REQ-18 | INT-3 |
| INT-5 | modify | `src/web/git/HistoryTab.tsx` | Give the graph every loaded commit with its parents. A merge draws a line to each parent, and the lines join across pages. A line to a parent not loaded yet runs to the end of the list. | REQ-9, REQ-10, REQ-11, REQ-19 | INT-1, INT-4 |
| INT-6 | modify | `src/web/git/HistoryTab.tsx` | Put a label on the first commit of the history (the tip): the branch name, or "detached" on a detached HEAD. | REQ-12 | INT-4 |
| INT-7 | modify | `src/web/git/GitExplorerPanel.tsx` | Pass the branch name, or the detached state, of the repository lookup to HistoryTab. | REQ-12 | INT-6 |
| INT-8 | modify | `src/web/git/CommitDetail.tsx` | Draw the file list of a commit with the list component of `batch-open-source-explorer`. Keep the kind labels, "Binary", the selection and the diff in DiffView. | REQ-14, REQ-15, REQ-16 | — |
| INT-9 | modify | `src/web/git/HistoryTab.test.tsx` | Adapt the tests to the new markup. Add cases for: lines of a merge, a straight line with no merges, the branch label, lines that join after "Load more". | REQ-10, REQ-11, REQ-12, REQ-19 | INT-5, INT-6 |
| INT-10 | modify | `e2e/git-explorer.spec.ts` | Use a fixture repository with a merge. Check the graph, the branch label, the files and the diff of the merge commit, the empty history and the dark theme. | REQ-3, REQ-4, REQ-8, REQ-9, REQ-10, REQ-12, REQ-14, REQ-15, REQ-16, REQ-17 | INT-5, INT-6, INT-8 |
| INT-11 | modify | `e2e/desktop-git-explorer-window.spec.ts` | In the desktop window, open a file diff in "Changes" and the graph in "History". The spec stays in the Electron group. | REQ-5 | INT-5 |
| INT-12 | modify | the licence texts of `batch-open-source-explorer/INT-7` | Add the licence text of the graph component. | REQ-7 | INT-3 |
| INT-13 | modify | `THIRD-PARTY-NOTICES.md` | Add the entry of the graph component: package, version, licence and the path of its licence text. | REQ-7 | INT-12 |

## Choosing the graph component

- The licence rule is the one of `batch-open-source-explorer` ("Choosing the components").
- The component draws the lanes from the commit hashes and their parents. It accepts new commits at the end of the list without breaking the lines already drawn.
- It works with React 18 and takes its colours from CSS variables.
- The implementer records the package in the "Dependencies" table of `.sdd/.archi`.

## Human acceptance

### Scenario: The user reads the history of a branch with a merge as a graph

- REQ → REQ-3, REQ-4, REQ-8, REQ-9, REQ-10, REQ-12, REQ-13
- Given → a session whose repository has a branch `main` with a merge of a feature branch
- When → the user opens the git explorer and the tab "History"
- Then → the commits show as a graph, newest first, with the label `main` on the top commit, and the merge commit has a line to each of its two parents
- And → each row shows the short hash, the message, the author and the date, in the colours of the active theme

### Scenario: The user opens the files and a diff of a merge commit

- REQ → REQ-14, REQ-15, REQ-16
- Given → the History tab of the repository above
- When → the user clicks the merge commit and then one of its files
- Then → the files list shows each file with its kind of change, and the diff shows the change against the first parent
- And → a binary file in a commit shows "Binary file, no diff shown"

### Scenario: The user loads a long history

- REQ → REQ-11, REQ-18, REQ-19
- Given → a repository with more than 100 commits and no merges
- When → the user clicks "Load more"
- Then → the next commits appear under the first ones, and the graph stays one straight line with no gap between the two parts

### Scenario: The user opens the history of a repository with no commits

- REQ → REQ-17
- Given → a session whose repository has no commits yet
- When → the user opens the tab "History"
- Then → the tab shows "No commits yet" and no error

### Scenario: The user uses the git explorer in the desktop window

- REQ → REQ-5
- Given → the desktop app with a session in a repository
- When → the user opens the git explorer
- Then → the diff of a changed file and the graph of the history show as in the browser page

### Scenario: The user finds the licences of the new components

- REQ → REQ-6, REQ-7
- Given → the built app
- When → the user opens `THIRD-PARTY-NOTICES.md` and the licence notices of the web build
- Then → each new component appears with its permissive licence
