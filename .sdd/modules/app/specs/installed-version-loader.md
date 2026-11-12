---
module: app
component: useInstalledVersion
type: frontend hook
---

# useInstalledVersion

**Purpose** → loads the installed version once when the page mounts.

## Contract

- `useInstalledVersion() → string | null`.
- on mount → one `GET /api/installed-version`. The value is `null` until it answers.
- answer `200` with `version` as non-empty text → that text, e.g. `0.2.2`.
- network error, status other than `200`, a body of the wrong shape → `null`.
- unmount → the request in flight is aborted; a late answer changes nothing.

## Rules and invariants

- One request per mount: no periodic refresh.
- It asks only the page's own server: no call to the release source.
- It never blocks the page: the rest of the page renders and works while the request waits.

## Dependencies

- InstalledVersionRoute

## Requirements served

- `plan-update_check/REQ-13`, `plan-update_check/REQ-15`
