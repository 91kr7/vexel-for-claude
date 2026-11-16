---
module: git
component: useRepositoryLookup
type: frontend hook
---

# useRepositoryLookup

**Purpose** → asks the server for the covered repositories of the open session folder.

## Contract

- `useRepositoryLookup(folder | undefined, revision = 0) → state`
  - `{ status: "loading" }` → no answer yet, or `folder` is `undefined`.
  - `{ status: "repositories", repositories }` → the answer of RepositoryRoute, with at least one entry. Each entry has `root`, `name`, `path`, and `branch` (`{ kind: "branch", name }` or `{ kind: "detached", hash }`) or `error`.
  - `{ status: "none" }` → no covered repository (an empty list counts as `none`), or git is not installed.
  - `{ status: "error", message }` →
    - the route answers with an error → its `message`, else "Could not read the repository.";
    - the request fails or the answer has another shape (an entry included) → "Could not read the repository."
- one request to `GET /api/git/repository?path=<folder>` when the hook mounts with a folder, and again only when `folder` or `revision` changes. No periodic request.
- a new `folder` → `loading` from the same render; the answer for the previous folder is dropped.
- a new `revision`, same folder → the current state stays until the new answer replaces it; an answer of an older revision is dropped.

## Dependencies

- RepositoryRoute

## Requirements served

- `plan-git_explorer/REQ-6`, `plan-git_explorer/REQ-23`, `plan-git_explorer/REQ-24`
- `plan-multi_repo_workspace/REQ-5`, `plan-multi_repo_workspace/REQ-6`, `plan-multi_repo_workspace/REQ-10`
