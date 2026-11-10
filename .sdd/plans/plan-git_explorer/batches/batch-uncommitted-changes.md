---
batch: uncommitted-changes
feature: Uncommitted changes
closed_req: [REQ-5, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15]
depends: [explorer-access]
---

# Batch — Uncommitted changes

Requirements: `.sdd/plans/plan-git_explorer/requirements.md`. This batch also serves REQ-6 and REQ-8. They close in `batch-history`.

The git runner, the panel and the repository lookup come from `batch-explorer-access`. Their paths are in the index of the module `git`.

## What this batch builds

- Changes lookup → the uncommitted changes of the whole repository, staged apart from unstaged.
- Diff reader → the diff of one file, marked line by line, with the binary note and the cut. `batch-history` reuses it.
- Diff view → the frontend view of one diff. `batch-history` reuses it.
- Changes tab → the list of the changed files in the panel.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | backend, module `git` | Parser of `git status --porcelain=v2 -z`. Each entry gives the path from the root, the old path of a rename, the group (staged or unstaged) and the kind. Untracked files go in the unstaged group. | REQ-9, REQ-10, REQ-11 | — |
| INT-2 | create | backend, module `git` | Changes lookup. It runs the status from the repository root, so the whole repository counts, untracked files included. It uses the git runner. | REQ-5, REQ-8, REQ-9 | INT-1 |
| INT-3 | create | backend, module `git` | Parser of the unified diff of one file. Each line is added, removed, context or hunk header. It marks a binary file, and cuts the diff after 5,000 lines with a cut mark. | REQ-12, REQ-14, REQ-15 | — |
| INT-4 | create | backend, module `git` | File diff lookup. Staged → against HEAD, or the empty tree with no commits. Unstaged → against the index. Untracked → every line added. It goes through INT-3. | REQ-8, REQ-12, REQ-14, REQ-15 | INT-3 |
| INT-5 | create | backend, module `git` | REST endpoints under `/api` for the changes list and for the diff of one file in one group. A git error gives an error answer with its message. | REQ-6, REQ-9, REQ-12 | INT-2, INT-4 |
| INT-6 | modify | `src/server/main.ts` | Registers the endpoints of INT-5. | REQ-9 | INT-5 |
| INT-7 | create | frontend, module `git` | Diff view in Roboto Mono. Added lines in the success colour with "+", removed lines in the error colour with "-", hunk headers muted. Notes "Binary file, no diff shown" and "Diff cut at 5,000 lines". | REQ-12, REQ-14, REQ-15 | — |
| INT-8 | create | frontend, module `git` | Changes tab: groups "Staged" and "Unstaged", each file with its path and a kind label ("Added", "Modified", "Deleted", "Renamed", "Untracked"). A rename shows old and new path. A click opens INT-7 for that file and group. | REQ-9, REQ-10, REQ-11, REQ-12 | INT-5, INT-7 |
| INT-9 | modify | frontend, module `git`: the panel of `batch-explorer-access/INT-8` | Shows the Changes tab in its body, and loads the changes when the panel opens. With no changes it says "No uncommitted changes". A git error shows with ErrorMessage. | REQ-6, REQ-13 | INT-8 |

## Human acceptance

### Scenario: The user sees the uncommitted changes and their diff

- REQ → REQ-5, REQ-9, REQ-10, REQ-11, REQ-12
- Given → a session on a subfolder of a repository, with a staged new file, an unstaged modified file in another folder of the repository, and an untracked file
- When → the user opens the git explorer and clicks the modified file
- Then → "Staged" lists the new file as "Added", "Unstaged" lists the modified file as "Modified" and the other file as "Untracked"
- And → the diff shows the added lines in green with "+" and the removed lines in red with "-"

### Scenario: A clean repository says it has no changes

- REQ → REQ-13
- Given → a session on a repository with no uncommitted changes
- When → the user opens the git explorer
- Then → the panel says "No uncommitted changes"

### Scenario: A binary file and a very large diff stay readable

- REQ → REQ-14, REQ-15
- Given → a repository with a changed PNG image and a text file with 20,000 changed lines
- When → the user clicks the image, then the text file
- Then → the image shows "Binary file, no diff shown", and the text file shows its first lines with "Diff cut at 5,000 lines"
- And → the page keeps reacting to clicks and scrolling
