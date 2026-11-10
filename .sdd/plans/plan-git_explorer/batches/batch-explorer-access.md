---
batch: explorer-access
feature: Git explorer access
closed_req: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-7]
depends: []
---

# Batch — Git explorer access

Requirements: `.sdd/plans/plan-git_explorer/requirements.md`. This batch also serves REQ-6 and REQ-8. They close in `batch-history` (see `batches.md`, "Coverage check").

## What this batch builds

- A new module `git`, backend and frontend. It holds every component of this plan. Its index and specs are written by the implementer.
- Git command runner → the only backend component that runs git. It runs read-only commands only.
- Repository lookup → tells whether a folder is in a repository, and gives the repository root and the branch.
- Git explorer panel → the panel of the session page that the later batches fill.
- "Git Explorer" button → the session header button that opens and closes the panel.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | backend, new module `git` | Git command runner. It runs only read-only git commands from a fixed list, always with `--no-optional-locks`, a 10 s timeout and a 5 MB output cap. It reports "git not installed" and git errors with git's message. | REQ-2, REQ-6, REQ-8 | — |
| INT-2 | create | backend, module `git` | Repository lookup of a folder. It gives the root path and the branch, or "detached" with the short hash, or "not a repository". A missing folder or no git counts as "not a repository". It works on a repository with no commits. | REQ-1, REQ-2, REQ-4 | INT-1 |
| INT-3 | create | backend, module `git` | REST endpoint under `/api` that gives the repository lookup of a folder path. A git error gives an error answer with its message. | REQ-1, REQ-2, REQ-4, REQ-6 | INT-2 |
| INT-4 | modify | `src/server/main.ts` | Registers the endpoint of INT-3. The LocalAccessGuard covers it, as every route. | REQ-1 | INT-3 |
| INT-5 | modify | `src/web/icons/Icons.tsx` | Adds the Lucide `git-branch` icon. | REQ-1 | — |
| INT-6 | create | frontend, new module `git` | Hook that asks the repository lookup for the folder of the open session, once when the session view opens. States: loading, repository, none, error. | REQ-1, REQ-2, REQ-6 | INT-3 |
| INT-7 | create | frontend, module `git` | Icon button "Git Explorer" (`git-branch`) that opens and closes the panel. It appears only when the lookup gives a repository. It has an accessible name, a tooltip and a visible focus, like the other header buttons. | REQ-1, REQ-2, REQ-3 | INT-5, INT-6 |
| INT-8 | create | frontend, module `git` | Git explorer panel, at the right of the session content, 50 % of its width, at least 360 px. Header: repository folder name with the full path as tooltip, and the branch chip. A git error shows with ErrorMessage. | REQ-4, REQ-6, REQ-7 | INT-6 |
| INT-9 | modify | `src/web/sessions/SessionView.tsx` | Puts the button of INT-7 first in the header actions, and the panel of INT-8 beside the terminal panel. The terminal fits the width that is left. | REQ-1, REQ-3 | INT-7, INT-8 |
| INT-10 | modify | `src/web/external/ConversationView.tsx` | Puts the button of INT-7 before "Resume Here", and the panel of INT-8 beside the conversation. | REQ-1, REQ-3 | INT-7, INT-8 |
| INT-11 | create | e2e, Electron group | Electron e2e spec: in the desktop window the button opens the panel, and the panel shows the repository and the branch. | REQ-7 | INT-9 |

## Human acceptance

### Scenario: The user opens the git explorer of a session in a repository

- REQ → REQ-1, REQ-3, REQ-4, REQ-7
- Given → a hosted session and an external session, each on a folder inside a git repository on the branch `main`
- When → the user opens the hosted session and clicks "Git Explorer" in its header
- Then → a panel opens at the right with the repository folder name, its full path on hover, and the branch `main`
- And → the external session shows the same button and panel, in the browser page and in the desktop window

### Scenario: A folder outside a repository has no git explorer

- REQ → REQ-2
- Given → a session on a folder that is not in a git repository
- When → the user opens the session
- Then → the header shows no "Git Explorer" button

### Scenario: A detached HEAD shows its commit

- REQ → REQ-4
- Given → a session on a repository with a detached HEAD
- When → the user opens the git explorer
- Then → the branch chip shows "detached" and the short hash
