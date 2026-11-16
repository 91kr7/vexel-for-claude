---
module: app
component: checkLatestRelease
type: backend service
---

# checkLatestRelease

**Purpose** → one request that asks the release source for the latest release, and its result. The launch check and the user's update check both use it.

## Contract

- `latestReleaseApiUrl(repositoryUrl) → string | undefined`
  - a GitHub repository address (`https://github.com/<owner>/<name>`, with an optional `git+` prefix and `.git` suffix) → `https://api.github.com/repos/<owner>/<name>/releases/latest`.
  - any other address → `undefined`.
- `releaseListUrl(sourceUrl) → string | undefined` → the address of the release list.
  - an address that ends with `/latest` → the same address without `/latest` (e.g. `…/releases/latest` → `…/releases`).
  - any other address, or `undefined` → `undefined`.
- `checkLatestRelease({ sourceUrl, installedVersion, fetch?, timeoutMs? }) → Promise<ReleaseCheckResult>`, never rejects. `fetch` default the global one, `timeoutMs` default 10 000.
- `ReleaseCheckResult` → one of:
  - `{ status: "newer", installedVersion, newerVersion, releaseUrl, changelogs? }`
  - `{ status: "none" }` → the check worked and no newer version exists.
  - `{ status: "failed" }` → the check could not get a valid answer.
- `sourceUrl` is `undefined` → `failed`, with no request.
- else one `GET <sourceUrl>` with `Accept: application/vnd.github+json`, limit `timeoutMs`.
- status `200`, a JSON body with `tag_name` and `html_url`, and `newerVersionOf(tag_name, installedVersion)` gives a version → `newer`, with that version and `html_url` as `releaseUrl`. checkLatestRelease never sets `changelogs`.
- `ReleaseChangelog` → `{ version, text? }`: a version without the `v`, and the release description. `text` is absent when the description is empty or missing.
- a tag that is not newer → `none`.
- network error, time-out, any status other than `200`, a body that is not JSON, a missing `tag_name`, or an `html_url` that is not an `http` or `https` address → `failed`.

## Rules and invariants

- The request carries no credentials, no cookie and no data about the user, the sessions or the folders.
- The GitHub "latest release" endpoint already leaves out drafts and pre-releases.
- A failure is never logged as an error. Only the user's update check shows it to the page (UpdateCheckRoute); the launch check hides it (NewerVersionRoute).

## Dependencies

- newerVersionOf

## Requirements served

- `plan-update_check/REQ-1`, `plan-update_check/REQ-3`, `plan-update_check/REQ-9`, `plan-update_check/REQ-12`
- `plan-release_changelog/REQ-7`, `plan-release_changelog/REQ-13`
- `plan-settings_dialog/REQ-45`, `plan-settings_dialog/REQ-50`
