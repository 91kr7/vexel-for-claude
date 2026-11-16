---
batch: notice-changelogs
feature: Changelogs in the newer version notice
closed_req: [REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17]
depends: []
---

# Batch — notice-changelogs

Requirements: `.sdd/plans/plan-release_changelog/requirements.md`.

## Decisions for this batch

- **Changelog** → the description (`body`) of a GitHub Release. An empty or missing description gives a release with no changelog text (REQ-13).
- **Source.** The release list of the repository on GitHub (`GET /repos/<owner>/<name>/releases`). Its address is the address of the release check without the final `/latest`. With `AI_CLIENT_RELEASE_SOURCE_URL` set, the list follows that local address too, so no e2e run calls GitHub. No new environment variable.
- **Which releases** → not draft, not pre-release, and newer than the installed version by `newerVersionOf` (REQ-7). Ordered by version, newest first, not by the order of the answer (REQ-8).
- **Pages.** Pages of 100 releases. The reader stops at the first page that holds a release not newer than the installed version, or at the last page.
- **When.** Only after the release check of the start gives `newer`. Once per server start, like the check. The listen and the session list never wait for it (REQ-16).
- **Request** → plain GET with Node's `fetch`, `Accept: application/vnd.github+json`, no credentials and no data about the user or the sessions, time limit 10 s per page (REQ-17).
- **Failure.** Any failure of the reader gives the result of the check without changelogs. The notice then looks as it does today (REQ-14). Nothing is logged as an error.
- **Rendering** → a small renderer in the client, with no new dependency. It turns the markup subset of batch `release-instruction` into React elements: headings, paragraphs, bullet lists, bold, italic, inline code, links. Any other markup shows as plain text (REQ-9).
- **Safety.** No raw HTML and no `dangerouslySetInnerHTML`: the text never runs as code (REQ-11). Images are left out, so the notice loads no remote content (assumption of the plan, see `batches.md`).
- **Links** → only `http` and `https` addresses become links, with `target="_blank"` and `rel="noopener noreferrer"`. The desktop window already sends such links to the system browser (DesktopApp spec), so no desktop code changes (REQ-10, REQ-15). Any other address shows as text.
- **Layout.** The box keeps its place, look and width (at most 320 px). Under the two versions comes the changelog area: one block per release, headed "Version <version>". The area scrolls. The box is never taller than the window below the top bar minus 24 px. The title, "View Release" and "Close Update Notice" stay outside the scroll area (REQ-12).
- **Electron e2e** of this batch, if any, go in the Electron group (`npm run test:e2e:desktop`), never in the default e2e run (knowledge base entry `electron-e2e-separate`).

## What this batch builds

- **Release changelog reader** → reads the release list and gives the changelogs of the releases newer than the installed version.
- **Changelog renderer** → shows the text of a changelog as safe, readable elements.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/server/release-check.ts` | `ReleaseCheckResult` with status `newer` gets an optional `changelogs`: a list of version and text (text absent when empty). Add the address of the release list, derived from the release check address. | REQ-7, REQ-13 | — |
| INT-2 | create | backend, module app, next to the release check | Release changelog reader: GET of the release list by pages, as in the decisions. Keeps the newer published releases, newest first, with their description. Any failure → no result, never a rejection. | REQ-7, REQ-8, REQ-13, REQ-17 | INT-1 |
| INT-3 | modify | `src/server/main.ts` | After a `newer` release check, runs the reader once with the same installed version and source. Adds its changelogs to the result given to the route; a reader failure keeps the result as today. The listen still does not wait. | REQ-7, REQ-14, REQ-15, REQ-16 | INT-2 |
| INT-4 | modify | `src/server/newer-version-route.ts` | The `newer` answer carries the `changelogs` field of the result, when present. | REQ-7 | INT-1 |
| INT-5 | modify | `src/web/newer-version/newer-version-loader.ts` | `NewerVersion` gets the optional changelogs. A missing or malformed `changelogs` field gives the `NewerVersion` without changelogs, not `null`. | REQ-7, REQ-14 | INT-4 |
| INT-6 | create | frontend, module app, `newer-version` area | Changelog renderer: markup subset to React elements, other markup as plain text. No raw HTML, no images. Only `http`/`https` links, with a target. | REQ-9, REQ-10, REQ-11 | — |
| INT-7 | modify | `src/web/newer-version/NewerVersionNotice.tsx` | Changelog area under the two versions: one block per release, newest first, headed by its version, text through the renderer or none. No changelogs → box as today. | REQ-7, REQ-8, REQ-9, REQ-13, REQ-14, REQ-15 | INT-5, INT-6 |
| INT-8 | modify | `src/web/styles.css` (`.update-notice*` rules) | Height limit of the box and scroll of the changelog area only. Title, "View Release" and "Close Update Notice" stay visible at any changelog length. The Windows 11 look changes only the corner radius, so `windows11.css` stays as it is. | REQ-12 | INT-7 |

## Human acceptance

### Scenario: The user reads what changed in the missing versions

- REQ → REQ-7, REQ-8, REQ-9, REQ-15, REQ-16
- Given → version 0.4.0 is installed, and GitHub has the published releases `v0.5.0` and `v0.6.0` with a changelog each, and a pre-release `v0.7.0-rc.1`
- When → the user launches the desktop app
- Then → the session list appears as usual, and the notice "Update Available" shows "Version 0.6.0", then "Version 0.5.0", each with its changelog as formatted text, headings and lists included, with no `#` or `*` signs
- And → nothing about `v0.7.0-rc.1` appears

### Scenario: The user opens a link of a changelog

- REQ → REQ-10, REQ-15
- Given → the notice shows a changelog with a link
- When → the user clicks the link in the desktop window
- Then → the page opens in the system browser, and the client window stays on its page

### Scenario: A long changelog scrolls inside the notice

- REQ → REQ-12
- Given → the notice shows changelogs longer than the window height
- When → the user scrolls inside the changelog area
- Then → the changelogs scroll, while the title, "View Release" and "Close Update Notice" stay visible and work

### Scenario: A release without a description shows only its version

- REQ → REQ-13
- Given → the published release `v0.5.0` has no description, and `v0.6.0` has a changelog
- When → the user launches the application
- Then → the notice shows "Version 0.6.0" with its changelog, and "Version 0.5.0" with no text under it

### Scenario: The changelogs cannot be read

- REQ → REQ-14, REQ-16
- Given → the latest release `v0.6.0` can be read, but the release list cannot
- When → the user launches the application
- Then → the notice shows "Version 0.6.0 is available. You have 0.4.0.", "View Release" and the close button, as before this change, with no error message

### Scenario: Markup in a changelog stays text

- REQ → REQ-11
- Given → a changelog contains a `<script>` tag, an HTML button and an image
- When → the user launches the application
- Then → the notice shows the tag and the button as plain text, shows no image, and nothing else happens in the page

### Scenario: The requests carry nothing about the user

- REQ → REQ-17
- Given → the release source is a local fake that prints each request it receives
- When → the user launches the application
- Then → the printed request for the release list has no credentials header, and no user, session or folder data in the address or headers
