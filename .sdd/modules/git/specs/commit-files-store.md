---
module: git
component: useCommitFiles
type: frontend hook
---

# useCommitFiles

**Purpose** → asks the server for the files of one commit.

## Contract

- `useCommitFiles(root, hash) → state`
  - `{ status: "loading" }` → no answer yet for `hash`.
  - `{ status: "loaded", files }` → `files` are the `CommitFile` entries of HistoryRoute.
  - `{ status: "error", message }` →
    - the route answers with an error → its `message`, else "Could not read the files of the commit.";
    - the request fails or the answer has another shape → "Could not read the files of the commit."
- one request to `GET /api/git/commit-files` with `path=<root>` and `hash` each time `root` or `hash` changes; the answer for a previous commit is dropped.

## Dependencies

- HistoryRoute

## Requirements served

- `plan-git_explorer/REQ-18`
