---
module: git
component: useChanges
type: frontend hook
---

# useChanges

**Purpose** → asks the server for the uncommitted changes of a repository.

## Contract

- `useChanges(root | undefined, revision = 0) → state`
  - `{ status: "loading" }` → no answer yet, or `root` is `undefined`.
  - `{ status: "loaded", changes }` → the `changes` of ChangesRoute (`{ group, kind, path, oldPath? }[]`).
  - `{ status: "error", message }` →
    - the route answers with an error → its `message`, else "Could not read the changes.";
    - the request fails or the answer has no `changes` list → "Could not read the changes."
- one request to `GET /api/git/changes?path=<root>` when the hook mounts with a root, and again only when `root` or `revision` changes. No periodic request.
- a new `root` → `loading` from the same render; the answer for the previous root is dropped.
- a new `revision`, same root → the current state stays until the new answer replaces it; an answer of an older revision is dropped.

## Dependencies

- ChangesRoute

## Requirements served

- `plan-git_explorer/REQ-6`, `plan-git_explorer/REQ-9`, `plan-git_explorer/REQ-24`
