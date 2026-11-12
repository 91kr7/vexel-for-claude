---
module: app
component: InstalledVersionRoute
type: REST endpoint
---

# InstalledVersionRoute

**Purpose** → gives the page the version of the installed application, at once.

## Contract

- `registerInstalledVersionRoute(app, installedVersion)` → `installedVersion` is the text given by the caller, e.g. `0.2.2`.
- `GET /api/installed-version` → always `200`, body `{ version: <installedVersion> }`, as given, with no `v` added.

## Rules and invariants

- It answers at once: it never waits for the release check and makes no network call.
- Every call of the same server start gives the same version.
- LocalAccessGuard applies as to every route.

## Dependencies

- LocalAccessGuard

## Requirements served

- `plan-update_check/REQ-14`, `plan-update_check/REQ-15`
