---
module: git
component: useFileDiff
type: frontend hook
---

# useFileDiff

**Purpose** → asks the server for the diff of one changed file.

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

## Dependencies

- ChangesRoute

## Requirements served

- `plan-git_explorer/REQ-12`
