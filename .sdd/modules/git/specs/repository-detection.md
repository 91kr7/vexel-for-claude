---
module: git
component: detectRepositories
type: backend function
---

# detectRepositories

**Purpose** → finds the covered repositories of a project folder: the repository around it and the repositories below it.

## Contract

- `detectRepositories(runner, folder) → RepositoryDetection`
  - `{ status: "repositories", repositories }` → at least one covered repository. Each entry:
    - `root` → absolute path of the repository root, with symbolic links resolved;
    - `name` → the last segment of `root`;
    - `path` → `root` relative to `folder`: `.` for `folder` itself, a `..` path for a repository above it, e.g. `web/app` below it;
    - `branch` → `{ kind: "branch", name }` or `{ kind: "detached", hash }`, as lookupRepository gives it;
    - or `error` in place of `branch` → the git message of a repository that git cannot read.
  - `{ status: "none" }` →
    - `folder` does not exist or is not a folder;
    - no covered repository;
    - git is not installed.

Order of the list:
- first, the repository of lookupRepository on `folder`, if there is one;
- then the repositories found below `folder`, in path order of their `path`. Paths compare segment by segment, so `api` comes before `api/plugins/x`, and `api/plugins/x` before `api-2`.
- a root appears once.

Which folders below `folder` are covered repositories:
- `folder` is level 0. A folder at level 1 to 4 that holds a `.git` entry (folder or file) is a candidate. A folder at level 5 or deeper is never read.
- the search enters found repositories too, so a repository inside another one is found.
- the search does not enter `.git`, symbolic links, or a folder named as one of: `node_modules`, `bower_components`, `jspm_packages`, `vendor`, `.venv`, `venv`, `__pycache__`, `.tox`, `.gradle`, `.m2`, `target`, `build`, `dist`, `out`, `.next`, `.nuxt`, `.dart_tool`, `Pods`, `.terraform`.
- a candidate that the repository around it tracks as a gitlink (mode `160000`, a submodule) is dropped. The search does not enter it.
- a linked worktree (`.git` file) is a covered repository.

Errors:
- a candidate where git fails → the entry has `error` with git's message. The other entries stay.
- a candidate whose `.git` git does not accept, so git finds another root → `error` "Not a valid git repository."
- lookupRepository fails with a git error other than "not a repository" → the first entry is `folder` itself (`path` `.`) with `error`.

## Rules and invariants

- Read only. It runs only `rev-parse`, `symbolic-ref` and `ls-files` through the GitRunner.
- No cache: each call searches again.
- No blocking: the folder reads are async and the search gives control back to the event loop between folders. At most 4 branch lookups run at the same time.
- No time limit.

## Dependencies

- lookupRepository, GitRunner

## Requirements served

- `plan-multi_repo_workspace/REQ-1`, `plan-multi_repo_workspace/REQ-2`, `plan-multi_repo_workspace/REQ-3`, `plan-multi_repo_workspace/REQ-4`, `plan-multi_repo_workspace/REQ-6`, `plan-multi_repo_workspace/REQ-8`, `plan-multi_repo_workspace/REQ-9`, `plan-multi_repo_workspace/REQ-10`, `plan-multi_repo_workspace/REQ-12`
