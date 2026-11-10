---
status: validated
---

# Batches — Git explorer for the session workspace

Requirements: `requirements.md`. Batch files: `batches/`.

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| `batch-explorer-access` | Git explorer access | REQ-1, REQ-2, REQ-3, REQ-4, REQ-7 | — | certified | The user opens the git explorer of a session in a repository |
| `batch-uncommitted-changes` | Uncommitted changes | REQ-5, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15 | `batch-explorer-access` | todo | The user sees the uncommitted changes and their diff |
| `batch-history` | History | REQ-6, REQ-8, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22 | `batch-uncommitted-changes` | todo | The user browses the history and the diff of a commit |
| `batch-refresh` | Refresh | REQ-23, REQ-24, REQ-25, REQ-26 | `batch-history` | todo | The git explorer follows a turn of another session in the same repository |

Order: `batch-explorer-access` → `batch-uncommitted-changes` → `batch-history` → `batch-refresh`. `batch-history` reuses the diff parser and the diff view of `batch-uncommitted-changes`. `batch-refresh` reloads the content of both tabs.

## Assumptions and decisions

- **New module `git`.** Every new component lives in a new module `git`, with a backend part and a frontend part, as the other modules split them (`.archi`). The implementer of `batch-explorer-access` creates its index and adds it to `modules.md`.
- **Components created by an earlier batch.** A later batch cannot give their path, because the implementer names them. Its `where` cites the INT that created them, for example `batch-explorer-access/INT-8`. The path is in the index of the module `git`.
- **Folder path, not session id.** The endpoints take the folder path of the session. A session id would fail for an external session that left the list while its view stays open. The LocalAccessGuard protects the endpoints, as every route.
- **Read-only (REQ-8).** One runner runs every git command, from a fixed list of read commands, with `--no-optional-locks`. That option keeps `git status` from writing the index while Claude runs git in the same folder.
- **Fixed sizes (REQ-15, REQ-21).** A diff is cut at 5,000 lines. The history loads 100 commits per page. A git command stops after 10 s or 5 MB of output and gives an error. These are planner choices. The spec sets no figure.
- **History content (REQ-16).** The commits are those `git log` lists for HEAD, merged commits included. The diff of a commit is against its first parent.
- **Panel layout.** The panel takes the right half of the session content, at least 360 px. The terminal or the conversation keeps the rest. The hosted terminal fits the new width, as on any resize.
- **Turn end for the refresh (REQ-25).** The panel uses the session list the page already has, not the turn-end event of the AttentionMonitor. That event skips the interrupted turns, and the plan refreshes on them too (`requirements.md`, "Same repository"). A turn end is a change from `working` to `idle`. A session is in the same repository when its folder is the repository root or under it, compared as paths. A folder reached through a symbolic link does not match.
- **Electron e2e.** The desktop window test of REQ-7 goes in the Electron group (knowledge base `electron-e2e-separate`). The other batches touch no desktop code and need no Electron test.

## Departures

- **REQ-25, same repository instead of same folder.** Departing from the spec, human decision of 2026-11-10. The spec says "a session in the same folder". The plan refreshes on a turn end of any session whose folder is in the same repository. The spec `.sdd/analysis/git_explorer.md` (section "Refresh") must be corrected.

## Coverage check

REQ → INT. Each REQ closes in the batch of the table above.

| REQ | Served by | Closes in |
|-----|-----------|-----------|
| REQ-1 | `batch-explorer-access` INT-2, INT-3, INT-4, INT-5, INT-6, INT-7, INT-9, INT-10 | `batch-explorer-access` |
| REQ-2 | `batch-explorer-access` INT-1, INT-2, INT-3, INT-6, INT-7 | `batch-explorer-access` |
| REQ-3 | `batch-explorer-access` INT-7, INT-9, INT-10 | `batch-explorer-access` |
| REQ-4 | `batch-explorer-access` INT-2, INT-3, INT-8 | `batch-explorer-access` |
| REQ-5 | `batch-uncommitted-changes` INT-2 | `batch-uncommitted-changes` |
| REQ-6 | `batch-explorer-access` INT-1, INT-3, INT-6, INT-8; `batch-uncommitted-changes` INT-5, INT-9; `batch-history` INT-5, INT-9 | `batch-history` |
| REQ-7 | `batch-explorer-access` INT-8, INT-11 | `batch-explorer-access` |
| REQ-8 | `batch-explorer-access` INT-1; `batch-uncommitted-changes` INT-2, INT-4; `batch-history` INT-2, INT-3, INT-4 | `batch-history` |
| REQ-9 | `batch-uncommitted-changes` INT-1, INT-2, INT-5, INT-6, INT-8 | `batch-uncommitted-changes` |
| REQ-10 | `batch-uncommitted-changes` INT-1, INT-8 | `batch-uncommitted-changes` |
| REQ-11 | `batch-uncommitted-changes` INT-1, INT-8 | `batch-uncommitted-changes` |
| REQ-12 | `batch-uncommitted-changes` INT-3, INT-4, INT-5, INT-7, INT-8 | `batch-uncommitted-changes` |
| REQ-13 | `batch-uncommitted-changes` INT-9 | `batch-uncommitted-changes` |
| REQ-14 | `batch-uncommitted-changes` INT-3, INT-4, INT-7 | `batch-uncommitted-changes` |
| REQ-15 | `batch-uncommitted-changes` INT-3, INT-4, INT-7 | `batch-uncommitted-changes` |
| REQ-16 | `batch-history` INT-1, INT-2, INT-5, INT-6, INT-7, INT-9 | `batch-history` |
| REQ-17 | `batch-history` INT-1, INT-7 | `batch-history` |
| REQ-18 | `batch-history` INT-3, INT-5, INT-8 | `batch-history` |
| REQ-19 | `batch-history` INT-4, INT-5, INT-8 | `batch-history` |
| REQ-20 | `batch-history` INT-2, INT-7 | `batch-history` |
| REQ-21 | `batch-history` INT-2, INT-7 | `batch-history` |
| REQ-22 | `batch-history` INT-3, INT-4, INT-8 | `batch-history` |
| REQ-23 | `batch-refresh` INT-6 | `batch-refresh` |
| REQ-24 | `batch-refresh` INT-5, INT-6 | `batch-refresh` |
| REQ-25 | `batch-refresh` INT-1, INT-2, INT-3, INT-4, INT-7 | `batch-refresh` |
| REQ-26 | `batch-refresh` INT-8 | `batch-refresh` |

INT → REQ: every INT of the four batches serves at least one REQ. There is no enabling INT.

REQ-6 and REQ-8 span three batches. Each batch that adds a git command keeps them true. They close in `batch-history`, which adds the last git commands.
