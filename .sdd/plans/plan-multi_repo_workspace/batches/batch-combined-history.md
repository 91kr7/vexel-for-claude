---
batch: batch-combined-history
feature: Combined history
closed_req: REQ-21, REQ-22, REQ-23, REQ-24, REQ-25, REQ-26, REQ-27
depends: batch-grouped-changes
---

# Batch — Combined history

Requirements: `../requirements.md`. Paths of the module `git` are in `.sdd/modules/git/index.md`.

The History tab shows the commits of every covered repository in one graph, newest first, each commit marked with its repository. The colours come from `batch-repo-detection`.

## What this batch builds

- **History merge** (frontend) → merges the loaded pages of several repositories into one list, newest first, and tells how far that list is complete.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/server/git/log-parser.ts` | Add the committer date to `LOG_FORMAT` and to `Commit`. The author date stays the date of the row. | REQ-21 | — |
| INT-2 | create | frontend, git area (history merge) | Merge the commits of several repositories newest first by committer date, and keep the order of each repository. Stop at the oldest loaded commit of any repository that has more pages. | REQ-21, REQ-24 | INT-1 |
| INT-3 | modify | `src/web/git/history-store.ts` | Take the list of covered roots and read the pages of each root. Give the merged commits, each with its repository, and the error of each failed root apart. | REQ-21, REQ-26 | INT-2 |
| INT-4 | modify | `src/web/git/history-store.ts` | "Load more" reads the next page of each repository at the border of INT-2. A refresh reads the first page of every root again, with today's rules. | REQ-21, REQ-24 | INT-3 |
| INT-5 | modify | `src/web/git/HistoryTab.tsx` | Give the graph commit ids qualified by repository. A line then never joins two repositories, also when two clones share a commit. | REQ-24, REQ-25 | INT-3 |
| INT-6 | modify | `src/web/git/HistoryTab.tsx` | With several repositories, each row shows its repository name with its colour mark. The branch label goes on the tip of each repository. With one repository, rows stay as today. | REQ-22, REQ-23, REQ-24, REQ-27 | INT-3 |
| INT-7 | modify | `src/web/git/HistoryTab.tsx` | A click on a commit opens CommitDetail on the root of its repository. After a refresh, the open commit stays open when the same repository still has that hash. | REQ-24 | INT-3 |
| INT-8 | modify | `src/web/git/GitExplorerPanel.tsx` | The History tab reads every covered root, in place of the first one (`batch-repo-detection/INT-12`). Pass name, colour and branch of each repository. Show the error of each failed repository above the commits. | REQ-21, REQ-22, REQ-23, REQ-26 | INT-3, INT-6 |
| INT-9 | modify | `src/server/git/log-parser.test.ts`, `src/web/git/history-store.test.tsx`, `src/web/git/HistoryTab.test.tsx`, `src/web/git/GitExplorerPanel.test.tsx` | Cover the committer date, several roots, "Load more" across two repositories, a shared commit in two clones, a failing repository and the single repository case. Add a unit test next to the history merge. | REQ-21, REQ-22, REQ-24, REQ-25, REQ-26, REQ-27 | INT-1 to INT-8 |
| INT-10 | modify | `e2e/git-explorer.spec.ts` | On the fixture of `batch-repo-detection/INT-16`, check the combined order, the repository marks, their colours against the header and the Changes groups, a commit detail of the second repository and "Load more". | REQ-21, REQ-22, REQ-23, REQ-24, REQ-25, REQ-27 | INT-1 to INT-8 |

## Notes for the implementer

- **Order (REQ-21).** The merge compares committer dates, because `--date-order` uses them. Each repository keeps the order git gives, so a commit never shows below one of its parents.
- **Border between parts (REQ-24).** The tab shows only the commits down to the border of INT-2. The rest stays loaded and shows after the next "Load more". Then the lines of each repository join across parts, as in `plan-git_graph/REQ-19`.
- **Test folders.** Gatekeeper decision, 2026-11-16: every test that runs detection uses temporary folders only, never the user's home folder.
- **Test parallelism.** Knowledge base `limited-test-parallelism`: at most 4 Vitest workers, at most 3 Playwright workers, and never two full suites at the same time.
- **Lane colours.** The lanes keep the colours of `plan-git_graph`. The repository colour is on the row mark, not on the lanes.

## Human acceptance

### Scenario: The user reads the history of every repository in one graph

- REQ → REQ-21, REQ-22, REQ-23, REQ-24, REQ-25
- Given → a session on a folder with the repositories `api` and `web/app`, each with commits on different days, and `api` with a merge
- When → the user opens the tab "History"
- Then → the commits of both repositories show in one list, newest first, each with the name of its repository in the colour of its header entry and Changes group
- And → the lines of the graph join only commits of the same repository, and the tip of each repository carries its branch name

### Scenario: The user opens a commit of a nested repository

- REQ → REQ-24
- Given → the History tab above
- When → the user clicks a commit of `web/app` and then one of its files
- Then → the files of that commit and the diff of the file in `web/app` show

### Scenario: The user loads more of a long combined history

- REQ → REQ-21, REQ-24
- Given → `api` and `web/app` each have more than 100 commits, with dates mixed
- When → the user clicks "Load more"
- Then → the next commits appear under the first ones, newest first, and the lines of each repository have no gap

### Scenario: The user sees one history fail while the others still show

- REQ → REQ-26
- Given → the folder above, where the `.git` of `web/app` is damaged
- When → the user opens the tab "History"
- Then → the tab shows the git message of `web/app`, and the commits of `api` below it

### Scenario: The history of a single repository looks as today

- REQ → REQ-27
- Given → a session on a folder that is the root of one repository
- When → the user opens the tab "History"
- Then → the graph shows with no repository name on the rows, as before this plan
