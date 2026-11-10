---
module: git
component: useFileDiff
type: frontend hook
---

# useFileDiff

**Purpose** → asks the server for the diff of one changed file, or of one file in a commit.

## Contract

- `useFileDiff(root, entry | undefined) → state`
  - `{ status: "idle" }` → `entry` is `undefined`.
  - `{ status: "loading" }` → no answer yet for `entry`.
  - `{ status: "loaded", diff }` → `diff` is `{ binary, cut, lines }` of ChangesRoute.
  - `{ status: "error", message }` →
    - the route answers with an error → its `message`, else "Could not read the diff.";
    - the request fails or the answer has another shape → "Could not read the diff."
- one request to `GET /api/git/diff` with `path=<root>`, `group`, `file=<entry.path>` and, for a rename, `oldPath`, each time `entry` or `root` changes.
- a new `entry` → `loading`; the answer for the previous entry is dropped.
- `useCommitFileDiff(root, hash, file | undefined) → state` → the same states and messages, for a `CommitFile` of useCommitFiles:
  - one request to `GET /api/git/commit-diff` with `path=<root>`, `hash`, `file=<file.path>` and, for a rename, `oldPath`, each time `root`, `hash` or `file` changes;
  - `file` `undefined` → `idle`.

## Dependencies

- ChangesRoute, HistoryRoute

## Requirements served

- `plan-git_explorer/REQ-12`, `plan-git_explorer/REQ-19`
