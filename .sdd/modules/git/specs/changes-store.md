---
module: git
component: useChanges
type: frontend hook
---

# useChanges

**Purpose** → asks the server for the uncommitted changes of each covered repository.

## Contract

- `useChanges(roots, revision = 0) → states` → one state per root, in the order of `roots`. Each state:
  - `{ status: "loading" }` → no answer yet for that root.
  - `{ status: "loaded", changes }` → the `changes` of ChangesRoute (`{ group, kind, path, oldPath? }[]`).
  - `{ status: "error", message }` →
    - the route answers with an error → its `message`, else "Could not read the changes.";
    - the request fails or the answer has no `changes` list → "Could not read the changes."
- `roots` empty → an empty list, and no request.
- one request to `GET /api/git/changes?path=<root>` per root: when the root enters the list, and again for every root at each new `revision`. The same roots in a new list send no request. No periodic request.
- a root that enters the list → `loading` from the same render. A root that leaves the list → its answer is dropped.
- a new `revision` → each root keeps its current state until its new answer replaces it; an answer of an older revision is dropped.
- the state of a root never depends on the answer of another root: a failing root does not change the others.
- the hook unmounts → every request in flight is dropped.

## Dependencies

- ChangesRoute

## Requirements served

- `plan-git_explorer/REQ-6`, `plan-git_explorer/REQ-9`, `plan-git_explorer/REQ-24`
- `plan-multi_repo_workspace/REQ-14`, `plan-multi_repo_workspace/REQ-19`
