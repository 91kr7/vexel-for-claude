---
module: app
component: checkForUpdates
type: frontend function
---

# checkForUpdates

**Purpose** → the page call of UpdateCheckRoute, with its answer checked.

## Contract

- `checkForUpdates(signal?) → Promise<UpdateCheckResult>`, never rejects. One `POST /api/update-check`, aborted by `signal`.
- `UpdateCheckResult` → one of:
  - `{ status: "newer", version }` → `version` is a `NewerVersion`, read with the rules of useNewerVersion: the three fields as text, `changelogs` kept only when well formed.
  - `{ status: "current", installedVersion }` → `installedVersion` is non-empty text.
  - `{ status: "failed" }`
- answer `200` with `status: "newer"` and a valid `NewerVersion` → `newer`.
- answer `200` with `status: "current"` and `installedVersion` as non-empty text → `current`.
- network error, abort, status other than `200`, a body that is not JSON or of the wrong shape (an unknown `status` included) → `failed`.

## Dependencies

- UpdateCheckRoute, useNewerVersion (`NewerVersion` type and its reading rules)

## Requirements served

- `plan-settings_dialog/REQ-45`, `plan-settings_dialog/REQ-50`
