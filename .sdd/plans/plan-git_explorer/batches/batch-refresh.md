---
batch: refresh
feature: Refresh
closed_req: [REQ-23, REQ-24, REQ-25, REQ-26]
depends: [history]
---

# Batch — Refresh

Requirements: `.sdd/plans/plan-git_explorer/requirements.md`.

The panel, its tabs and the diff view come from the earlier batches of this plan. Their paths are in the index of the module `git`.

## What this batch builds

- Turn-end watcher → tells the panel when a session in the same repository ends a turn.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/AppLayout.tsx` | Passes the session list of LiveSessionStore to the open SessionView and ConversationView. | REQ-25 | — |
| INT-2 | modify | `src/web/sessions/SessionView.tsx` | Passes the session list on to the git explorer panel. | REQ-25 | INT-1 |
| INT-3 | modify | `src/web/external/ConversationView.tsx` | Passes the session list on to the git explorer panel. | REQ-25 | INT-1 |
| INT-4 | create | frontend, module `git` | Turn-end watcher. From one session list to the next, it signals when a hosted or external session goes from `working` to `idle` and its folder is the repository root or under it. | REQ-25 | — |
| INT-5 | modify | `src/web/icons/Icons.tsx` | Adds the Lucide `refresh-cw` icon. | REQ-24 | — |
| INT-6 | modify | frontend, module `git`: the panel of `batch-explorer-access/INT-8` | Icon button "Refresh" in the panel header. A refresh reads the repository, the changes and the first history page again. Each opening of the panel reads them again, with nothing kept from the last opening. | REQ-23, REQ-24 | INT-5 |
| INT-7 | modify | frontend, module `git`: the panel of `batch-explorer-access/INT-8` | Runs the refresh of INT-6 on each signal of INT-4. | REQ-25 | INT-2, INT-3, INT-4, INT-6 |
| INT-8 | modify | frontend, module `git`: the panel of `batch-explorer-access/INT-8` | After a refresh, the open diff loads again when its file is still in the same group, else it closes. An open commit closes when it is no longer in the history. | REQ-26 | INT-6 |

## Human acceptance

### Scenario: The git explorer follows a turn of another session in the same repository

- REQ → REQ-25, REQ-26
- Given → session A on `~/progetto` with the git explorer open on the diff of `README.md`, and session B on `~/progetto/frontend`
- When → session B ends a turn that changed `README.md` and created `frontend/new.ts`
- Then → without any click, the panel of session A lists `frontend/new.ts` as "Untracked", and the diff of `README.md` shows the new lines

### Scenario: The user refreshes by hand

- REQ → REQ-24, REQ-26
- Given → the git explorer open on the diff of a modified file
- When → the user restores that file in a terminal and clicks "Refresh"
- Then → the file leaves the list and its diff closes

### Scenario: Opening the panel again reads the repository again

- REQ → REQ-23
- Given → the git explorer closed, after a commit made in a terminal
- When → the user opens the git explorer
- Then → "History" shows the new commit and "Changes" no longer lists its files
