---
batch: batch-repo-filter
feature: Repository filter
closed_req: REQ-28, REQ-29, REQ-30, REQ-31
depends: batch-combined-history
---

# Batch — Repository filter

Requirements: `../requirements.md`. Paths of the module `git` are in `.sdd/modules/git/index.md`.

The user picks one or more repositories in the repository list of the header. The Changes and History tabs then show only those repositories.

## What this batch builds

- **Repository filter store** (frontend) → keeps the chosen repositories of each project folder in memory while the page stays open.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | frontend, git area (repository filter store) | Keep the chosen roots per project folder in memory, for the life of the page. Drop a root that the covered list no longer holds. An empty choice means no filter. | REQ-28, REQ-30 | — |
| INT-2 | modify | the repository list of `batch-repo-detection/INT-10` | Each entry becomes a toggle with a pressed state. An "All repositories" control clears the filter. The list shows only with several repositories, so one repository has no filter. | REQ-28, REQ-30, REQ-31 | INT-1 |
| INT-3 | modify | `src/web/git/GitExplorerPanel.tsx` | Give the Changes and History tabs only the chosen repositories, and every repository with no filter. Keep the colour of each repository from its position in the full list. | REQ-29, REQ-30 | INT-1 |
| INT-4 | modify | `src/web/git/GitExplorerPanel.test.tsx`, the unit test of the repository list | Cover one and two chosen repositories, clearing the filter, a chosen repository removed by a refresh and the single repository case. Add a unit test next to the filter store. | REQ-28, REQ-29, REQ-30, REQ-31 | INT-1 to INT-3 |
| INT-5 | modify | `e2e/git-explorer.spec.ts` | On the fixture of `batch-repo-detection/INT-16`, choose one repository, check both tabs, close and open the panel, then clear the filter. | REQ-28, REQ-29, REQ-30, REQ-31 | INT-1 to INT-3 |

## Notes for the implementer

- **Test folders.** Gatekeeper decision, 2026-11-16: every test that runs detection uses temporary folders only, never the user's home folder.
- **Test parallelism.** Knowledge base `limited-test-parallelism`: at most 4 Vitest workers, at most 3 Playwright workers, and never two full suites at the same time.

## Human acceptance

### Scenario: The user filters the git explorer by one repository

- REQ → REQ-28, REQ-29
- Given → a session on a folder with the repositories `api`, `tools` and `web/app`, each with changes and commits
- When → the user picks `web/app` in the repository list
- Then → the Changes tab shows only the group `web/app`, and the History tab shows only the commits of `web/app`
- And → picking `api` as well shows both `api` and `web/app` in both tabs

### Scenario: The user clears the filter

- REQ → REQ-30
- Given → the filter above holds `web/app`
- When → the user clicks "All repositories"
- Then → both tabs show `api`, `tools` and `web/app` again

### Scenario: A single repository has no filter

- REQ → REQ-31
- Given → a session on a folder that is the root of one repository
- When → the user opens the git explorer
- Then → the header shows no repository list and no filter control
