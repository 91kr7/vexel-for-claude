---
module: app
component: checkLatestRelease
type: backend service
---

# checkLatestRelease

**Purpose** → the one request at launch that asks the release source for the latest release, and its result.

## Contract

- `latestReleaseApiUrl(repositoryUrl) → string | undefined`
  - a GitHub repository address (`https://github.com/<owner>/<name>`, with an optional `git+` prefix and `.git` suffix) → `https://api.github.com/repos/<owner>/<name>/releases/latest`.
  - any other address → `undefined`.
- `checkLatestRelease({ sourceUrl, installedVersion, fetch?, timeoutMs? }) → Promise<ReleaseCheckResult>`, never rejects. `fetch` default the global one, `timeoutMs` default 10 000.
- `ReleaseCheckResult` → one of:
  - `{ status: "newer", installedVersion, newerVersion, releaseUrl }`
  - `{ status: "none" }`
- `sourceUrl` is `undefined` → `none`, with no request.
- else one `GET <sourceUrl>` with `Accept: application/vnd.github+json`, limit `timeoutMs`.
- status `200`, a JSON body with `tag_name` and `html_url`, and `newerVersionOf(tag_name, installedVersion)` gives a version → `newer`, with that version and `html_url` as `releaseUrl`.
- a tag that is not newer → `none`.
- network error, time-out, any status other than `200`, a body that is not JSON, a missing `tag_name`, or an `html_url` that is not an `http` or `https` address → `none`.

## Rules and invariants

- The request carries no credentials, no cookie and no data about the user, the sessions or the folders.
- The GitHub "latest release" endpoint already leaves out drafts and pre-releases.
- A failure is never logged as an error and never reaches the page as an error.

## Dependencies

- newerVersionOf

## Requirements served

- `plan-update_check/REQ-1`, `plan-update_check/REQ-3`, `plan-update_check/REQ-9`, `plan-update_check/REQ-12`
