---
module: app
component: UpdateCheckRoute
type: REST endpoint
---

# UpdateCheckRoute

**Purpose** → runs the release check again when the user asks for it, and tells the page the result.

## Contract

- `checkForUpdate({ sourceUrl, installedVersion, fetch? }) → Promise<ReleaseCheckResult>`, never rejects. The launch check and this route both use it.
  - one checkLatestRelease with `sourceUrl` and `installedVersion`.
  - result `newer` → one readReleaseChangelogs with the same installed version and the list address `releaseListUrl(sourceUrl)`. Its changelogs are added as `changelogs`; no changelogs → the `newer` result as the check gave it.
  - result `none` or `failed` → that result, with no changelog reading.
- `registerUpdateCheckRoute(app, { sourceUrl, installedVersion, fetch? })`.
- `POST /api/update-check` → always `200`, body one of:
  - `{ status: "newer", installedVersion, newerVersion, releaseUrl, changelogs? }`
  - `{ status: "current", installedVersion }` → the check gave `none`.
  - `{ status: "failed" }` → the check gave `failed`, or the check threw.
- each call that finds no check in flight starts one new checkForUpdate. Calls that arrive while it runs get its result and start nothing.

## Rules and invariants

- The request to the release source carries no credentials and no data about the user, the sessions or the folders (checkLatestRelease, readReleaseChangelogs).
- It never changes the result of the launch check that NewerVersionRoute gives.
- LocalAccessGuard applies as to every route.

## Dependencies

- checkLatestRelease, releaseListUrl, readReleaseChangelogs, LocalAccessGuard

## Requirements served

- `plan-settings_dialog/REQ-45`, `plan-settings_dialog/REQ-47`, `plan-settings_dialog/REQ-48`, `plan-settings_dialog/REQ-50`
