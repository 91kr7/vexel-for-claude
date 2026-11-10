---
module: git
component: useChanges
type: frontend hook
---

# useChanges

**Purpose** → asks the server for the uncommitted changes of a repository.

## Contract

- `useChanges(root | undefined) → state`
  - `{ status: "loading" }` → no answer yet, or `root` is `undefined`.
  - `{ status: "loaded", changes }` → the `changes` of ChangesRoute (`{ group, kind, path, oldPath? }[]`).
  - `{ status: "error", message }` →
    - the route answers with an error → its `message`, else "Could not read the changes.";
    - the request fails or the answer has no `changes` list → "Could not read the changes."
- one request to `GET /api/git/changes?path=<root>` when the hook mounts with a root, and again only when `root` changes. No periodic request.
- a new `root` → `loading` again; the answer for the previous root is dropped.

## Dependencies

- ChangesRoute

## Requirements served

- `plan-git_explorer/REQ-6`, `plan-git_explorer/REQ-9`
