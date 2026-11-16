---
module: app
component: NewerVersionRoute
type: REST endpoint
---

# NewerVersionRoute

**Purpose** → gives the page the result of the release check of this server start.

## Contract

- `registerNewerVersionRoute(app, result)` → `result` is the promise of the one checkLatestRelease of the start.
- `GET /api/newer-version` → always `200`, body:
  - `{ status: "newer", installedVersion, newerVersion, releaseUrl, changelogs? }` → `changelogs` (a list of `{ version, text? }`) only when the result has it.
  - `{ status: "none" }` → also when the check gave `failed`: the page sees no failure at launch.
- while the check runs, the answer waits for it.
- a `result` that rejects → `{ status: "none" }`.

## Rules and invariants

- It never starts a check: every call of the same server start gives the same result.
- LocalAccessGuard applies as to every route.

## Dependencies

- checkLatestRelease (`ReleaseCheckResult`), LocalAccessGuard

## Requirements served

- `plan-update_check/REQ-2`, `plan-update_check/REQ-9`
- `plan-release_changelog/REQ-7`
- `plan-settings_dialog/REQ-52`
