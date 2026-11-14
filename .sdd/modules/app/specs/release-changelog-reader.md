---
module: app
component: readReleaseChangelogs
type: backend service
---

# readReleaseChangelogs

**Purpose** → reads the release list of the release source and gives the changelogs of the published releases newer than the installed version.

## Contract

- `readReleaseChangelogs({ listUrl, installedVersion, fetch?, timeoutMs? }) → Promise<ReleaseChangelog[] | undefined>`, never rejects. `fetch` default the global one, `timeoutMs` default 10 000 per page.
- `listUrl` is `undefined` → `undefined`, with no request.
- requests → `GET <listUrl>?per_page=100&page=<n>`, `n` from 1, with `Accept: application/vnd.github+json` and limit `timeoutMs` each.
- an entry is kept when → `draft` is not `true`, `prerelease` is not `true`, `tag_name` is text, and `newerVersionOf(tag_name, installedVersion)` gives a version.
- each kept entry → `{ version, text }`: the version from `newerVersionOf`, and `body` as `text`. `body` empty, blank or not text → no `text`.
- a version already kept (e.g. `v0.5.0` and `0.5.0`) → only the first one stays.
- result → the kept entries ordered by version, newest first, whatever the order of the answer. No entry kept → `[]`.
- pages → it asks for the next page only while the current page holds 100 entries and no published release (not draft, not pre-release) that is not newer. At most 10 pages.
- any page with network error, time-out, status other than `200`, a body that is not JSON or not a list → `undefined`, also when earlier pages were read.
- an entry that is not an object, or has no text `tag_name` → skipped.

## Rules and invariants

- The requests carry no credentials, no cookie and no data about the user, the sessions or the folders.
- A failure is never logged as an error.

## Dependencies

- newerVersionOf, checkLatestRelease (`ReleaseChangelog` type)

## Requirements served

- `plan-release_changelog/REQ-7`, `plan-release_changelog/REQ-8`, `plan-release_changelog/REQ-13`, `plan-release_changelog/REQ-17`
