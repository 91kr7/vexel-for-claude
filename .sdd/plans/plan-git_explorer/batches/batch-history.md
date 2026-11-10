---
batch: history
feature: History
closed_req: [REQ-6, REQ-8, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22]
depends: [uncommitted-changes]
---

# Batch — History

Requirements: `.sdd/plans/plan-git_explorer/requirements.md`. This batch adds the last git commands of the plan, so REQ-6 and REQ-8 close here.

The git runner, the panel, the diff parser and the diff view come from `batch-explorer-access` and `batch-uncommitted-changes`. Their paths are in the index of the module `git`.

## What this batch builds

- History lookup → the commits of the current branch, in pages.
- Commit lookup → the files a commit changed, and the diff of one of them.
- History tab → the commit list in the panel, with the files and diffs of a commit.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | backend, module `git` | Parser of a `git log` output with fields split by NUL: full hash, short hash, full message, author name, author date. | REQ-16, REQ-17 | — |
| INT-2 | create | backend, module `git` | History lookup: commits reachable from HEAD, newest first, as `git log` lists them, in pages of 100 from an offset. A repository with no commits gives an empty list, not an error. | REQ-8, REQ-16, REQ-20, REQ-21 | INT-1 |
| INT-3 | create | backend, module `git` | Commit files lookup: files changed against the first parent, or the empty tree for the first commit, with kind, renames and a binary mark. | REQ-8, REQ-18, REQ-22 | — |
| INT-4 | create | backend, module `git` | Commit file diff lookup: diff of one file in a commit against the same parent as INT-3. It goes through the diff parser of `batch-uncommitted-changes/INT-3`. | REQ-8, REQ-19, REQ-22 | — |
| INT-5 | create | backend, module `git` | REST endpoints under `/api` for a history page, the files of a commit and the diff of one file in a commit. A git error gives an error answer with its message. | REQ-6, REQ-16, REQ-18, REQ-19 | INT-2, INT-3, INT-4 |
| INT-6 | modify | `src/server/main.ts` | Registers the endpoints of INT-5. | REQ-16 | INT-5 |
| INT-7 | create | frontend, module `git` | History tab: one row per commit with short hash, first line of the message, author and date. "Load more" asks for the next page. No commits → "No commits yet". | REQ-16, REQ-17, REQ-20, REQ-21 | INT-5 |
| INT-8 | create | frontend, module `git` | Commit detail: full message and the changed files with their kind label. A click on a file opens the diff view of `batch-uncommitted-changes/INT-7`. | REQ-18, REQ-19, REQ-22 | INT-5 |
| INT-9 | modify | frontend, module `git`: the panel of `batch-explorer-access/INT-8` | Adds the tabs "Changes" and "History" under the panel header. History loads its first page when its tab first opens. A git error shows with ErrorMessage, and only in the panel. | REQ-6, REQ-16 | INT-7, INT-8 |

## Human acceptance

### Scenario: The user browses the history and the diff of a commit

- REQ → REQ-16, REQ-17, REQ-18, REQ-19
- Given → a session on a repository with three commits on the current branch
- When → the user opens the git explorer, opens "History", clicks the newest commit and then one of its files
- Then → the list shows the three commits newest first, each with short hash, message, author and date
- And → the commit shows its changed files, and the file shows its diff in that commit

### Scenario: A new repository shows an empty history

- REQ → REQ-20
- Given → a session on a repository with no commits yet
- When → the user opens "History"
- Then → the tab says "No commits yet" and shows no error

### Scenario: A long history and a binary file in a commit

- REQ → REQ-21, REQ-22
- Given → a repository with 250 commits, the newest of which adds a PNG image
- When → the user opens "History", clicks "Load more" twice, then clicks the newest commit and its image
- Then → the list grows to 250 commits without freezing the page, and the image shows "Binary file, no diff shown"

### Scenario: A git error stays in the panel and changes nothing

- REQ → REQ-6, REQ-8
- Given → a session on a repository whose `.git/index` file is corrupt
- When → the user opens the git explorer
- Then → "Changes" shows the git error as a message, and the session, the list and the other sessions keep working
- And → `git status` in a terminal shows the same state as before the panel opened
