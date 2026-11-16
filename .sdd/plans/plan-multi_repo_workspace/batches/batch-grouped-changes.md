---
batch: batch-grouped-changes
feature: Grouped changes
closed_req: REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20
depends: batch-repo-detection
---

# Batch — Grouped changes

Requirements: `../requirements.md`. Paths of the module `git` are in `.sdd/modules/git/index.md`.

The Changes tab shows the uncommitted changes of every covered repository, one group per repository. The covered list, the colours and the repository list come from `batch-repo-detection`.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/git/changes-store.ts` | Take the list of covered roots and give one state per root. Keep one request per root and today's loading, revision and error rules for each root. | REQ-14, REQ-19 | — |
| INT-2 | modify | `src/web/git/ChangesTab.tsx` | Take the repositories with their changes. Show one group per repository, in list order, headed by its name and colour mark. Inside a group, "Staged" and "Unstaged" stay as today. | REQ-14, REQ-15, REQ-16 | INT-1 |
| INT-3 | modify | `src/web/git/ChangesTab.tsx` | A group with no changes shows "No uncommitted changes". A group whose read failed shows its message in an ErrorMessage. | REQ-17, REQ-19 | INT-2 |
| INT-4 | modify | `src/web/git/ChangesTab.tsx` | Key the selection by repository, group and path, and load the diff from the root of that repository. Keep today's selection rule after a refresh. | REQ-18 | INT-2 |
| INT-5 | modify | `src/web/git/ChangesTab.tsx` | With one repository, show no repository group: the list, the empty note and the error as today. | REQ-20 | INT-2 |
| INT-6 | modify | `src/web/git/GitExplorerPanel.tsx` | The Changes tab reads every covered root, in place of the first one (`batch-repo-detection/INT-12`). "Loading…" shows until each root has its first answer. | REQ-14, REQ-19, REQ-20 | INT-1, INT-2 |
| INT-7 | modify | `src/web/git/changes-store.test.tsx`, `src/web/git/ChangesTab.test.tsx`, `src/web/git/GitExplorerPanel.test.tsx` | Cover several roots, the group headers, an empty group, a failing group, a diff in the second repository and the single repository case. | REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20 | INT-1 to INT-6 |
| INT-8 | modify | `e2e/git-explorer.spec.ts` | On the fixture of `batch-repo-detection/INT-16`, check the groups, staged and unstaged in a group, an empty group and a diff of the second repository. | REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-20 | INT-1 to INT-6 |

## Notes for the implementer

- **Test folders.** Gatekeeper decision, 2026-11-16: every test that runs detection uses temporary folders only, never the user's home folder.
- **Test parallelism.** Knowledge base `limited-test-parallelism`: at most 4 Vitest workers, at most 3 Playwright workers, and never two full suites at the same time.

## Human acceptance

### Scenario: The user reads the changes of every repository, grouped

- REQ → REQ-14, REQ-15, REQ-16, REQ-17
- Given → a session on a folder with the repositories `api` and `web/app`. `api` has one staged and one unstaged file. `web/app` has no changes.
- When → the user opens the git explorer
- Then → the Changes tab shows the group `api`, then the group `web/app`, each with the colour of its entry in the header
- And → `api` shows "Staged" and "Unstaged" apart, and `web/app` shows "No uncommitted changes"

### Scenario: The user opens a diff in a nested repository

- REQ → REQ-18
- Given → the Changes tab above, after the user edits a file of `web/app` and clicks "Refresh"
- When → the user clicks that file in the group `web/app`
- Then → the diff of that file in `web/app` shows below the list

### Scenario: The user sees one group fail while the others still show

- REQ → REQ-19
- Given → the folder above, where the `.git` of `web/app` is damaged
- When → the user opens the Changes tab
- Then → the group `web/app` shows the git message, and the group `api` shows its files

### Scenario: The changes of a single repository look as today

- REQ → REQ-20
- Given → a session on a folder that is the root of one repository with changes
- When → the user opens the Changes tab
- Then → the tab shows "Staged" and "Unstaged" with no repository group, as before this plan
