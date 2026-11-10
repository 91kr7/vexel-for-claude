---
module: git
component: useRepositoryLookup
type: frontend hook
---

# useRepositoryLookup

**Purpose** → asks the server whether the folder of the open session is in a repository.

## Contract

- `useRepositoryLookup(folder | undefined, revision = 0) → state`
  - `{ status: "loading" }` → no answer yet, or `folder` is `undefined`.
  - `{ status: "repository", root, branch }` → the answer of RepositoryRoute. `branch` is `{ kind: "branch", name }` or `{ kind: "detached", hash }`.
  - `{ status: "none" }` → the folder is not in a repository, or git is not installed.
  - `{ status: "error", message }` →
    - the route answers with an error → its `message`, else "Could not read the repository.";
    - the request fails or the answer has another shape → "Could not read the repository."
- one request to `GET /api/git/repository?path=<folder>` when the hook mounts with a folder, and again only when `folder` or `revision` changes. No periodic request.
- a new `folder` → `loading` from the same render; the answer for the previous folder is dropped.
- a new `revision`, same folder → the current state stays until the new answer replaces it; an answer of an older revision is dropped.

## Dependencies

- RepositoryRoute

## Requirements served

- `plan-git_explorer/REQ-1`, `plan-git_explorer/REQ-2`, `plan-git_explorer/REQ-6`, `plan-git_explorer/REQ-23`, `plan-git_explorer/REQ-24`
