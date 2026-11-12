---
module: app
component: useNewerVersion
type: frontend hook
---

# useNewerVersion

**Purpose** → loads the result of the launch's release check once when the page mounts.

## Contract

- `useNewerVersion() → NewerVersion | null`, with `NewerVersion` → `{ installedVersion, newerVersion, releaseUrl }`.
- on mount → one `GET /api/newer-version`, in the background. The value is `null` until it answers.
- answer `200` with `status: "newer"` and the three fields as text → that `NewerVersion`.
- `status: "none"`, network error, status other than `200`, a body of the wrong shape → `null`.
- unmount → the request in flight is aborted; a late answer changes nothing.

## Rules and invariants

- One request per mount: no periodic refresh.
- It never blocks the page: the rest of the page renders and works while the request waits.

## Dependencies

- NewerVersionRoute

## Requirements served

- `plan-update_check/REQ-9`, `plan-update_check/REQ-11`
