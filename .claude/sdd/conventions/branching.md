# Convention — Development branch

No development happens directly on `main`: every piece of work — **evolution or bugfix, no exception
for its size** — lives on its own branch, opened from `main` and reintegrated at the end.

**The branch covers the whole cycle**, not just the code → the analysis, the plan and the batches of
one request share a single branch. `/sdd-analyse` normally opens it; `/sdd-plan` and `/sdd-dev` find
it already there. No artifact of the workflow — the analysis included — is ever committed on `main`.

## Opening

- Branch created **from `main`**, up to date, before the first commit of the step.
- Opened by the **first command of the cycle that writes something**, and only by it: every later
  command switches to it → the operation is always "open or switch", never "open a second one".
- `/sdd-init` is outside this: it bootstraps the repository rather than working a request, so it has
  no slug to name a branch after and commits on `main`. A cycle starts at `/sdd-analyse`.
- Name → `<type>/<request slug>`, where the type is `feat` for a new case or an evolution and `fix`
  for a bugfix, e.g. `feat/library_management`, `fix/login_timeout`.
- The slug is the analysis's `request_slug`, and the plan of that request reuses it: one request,
  one slug, one branch, from the analysis to the last batch.
- Name and type are known only once the analysis exists → `/sdd-analyse` opens the branch **after**
  its subagent returns and **before** the commit: the file is untracked, it follows the switch.
- Branch already existing and **not yet merged** into `main` (an interrupted cycle) → switch to it.
- Branch already existing and **already merged** into `main` → the request would reopen work already
  reintegrated: report it to the user and stop, it is their call how to proceed.
- Uncommitted changes in the working tree when opening → report them to the user and stop: it is
  their call how to handle them.

## During the work

- Every commit of the workflow lands on this branch → convention `commit.md`.
- `main` stays untouched until the reintegration.

## Reintegration

- Only when the work is **complete**: for a plan, all its batches `certified`.
- The orchestrator **proposes** the reintegration into `main` and waits for the human's yes: the
  merge is never automatic.
- The one exception is `/sdd-auto`. There the human chose automatic reintegration: the orchestrator
  merges once every batch is `certified` and the suites are green.
- Work left incomplete → no reintegration: the branch stays as it is, and the user is told what is
  missing.
