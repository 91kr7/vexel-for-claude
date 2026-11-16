---
batch: update-check
feature: Update check in the settings
closed_req: [REQ-43, REQ-44, REQ-45, REQ-46, REQ-47, REQ-48, REQ-49, REQ-50, REQ-51, REQ-52]
depends: [shortcuts-section]
---

# Batch update-check — Update check in the settings

Requirements → `.sdd/plans/plan-settings_dialog/requirements.md`. The settings popup exists, with the tabs "Theme", "Window Look" and "Shortcuts". This batch adds the "Updates" tab, where the user runs the launch release check by hand.

## What this batch builds

- **Update check route** → a server route that runs the release check again on request, and tells the page if the client is up to date, if a newer version exists, or if the check failed.
- **Updates section** → the "Updates" tab of the settings popup: the installed version, "Check for Updates" and the result.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/server/release-check.ts` | Add the result `{ status: "failed" }` for no source address, network error, time-out, a status other than `200` and a bad body. `none` stays only for a valid tag that is not newer. | REQ-45, REQ-50 | — |
| INT-2 | modify | `src/server/newer-version-route.ts` | A `failed` result answers `{ status: "none" }`, so the page sees no failure at launch. | REQ-52 | INT-1 |
| INT-3 | create | backend, app area (release check) | Route `POST /api/update-check`: one new checkLatestRelease, then the changelogs as at launch. It answers the `newer` result, `{ status: "current", installedVersion }` or `{ status: "failed" }`. Calls that overlap share one check. | REQ-45, REQ-47, REQ-48, REQ-50 | INT-1 |
| INT-4 | modify | `src/server/main.ts` | Register the route of INT-3 with the source address, installed version and release list address of the launch check. The launch check still runs once per start. | REQ-45, REQ-52 | INT-3 |
| INT-5 | create | frontend, app area (newer version) | Page call of the route: gives `newer` (as `NewerVersion`, changelogs included), `current` or `failed`. A network error, another status or a body of the wrong shape gives `failed`. | REQ-45, REQ-50 | INT-3 |
| INT-6 | create | frontend, app area (settings) | Updates section: the installed version of useInstalledVersion and "Check for Updates". While the check runs, the button is disabled and reads "Checking…". Then it shows the result with the texts below. | REQ-44, REQ-46, REQ-47, REQ-48, REQ-50, REQ-51 | INT-5 |
| INT-7 | modify | `src/web/settings/SettingsDialog.tsx` | Add the "Updates" tab after "Shortcuts", with the section of INT-6. Pass on a callback that gets a `newer` result. | REQ-43, REQ-51 | INT-6 |
| INT-8 | modify | `src/web/AppLayout.tsx` | A `newer` result of the user's check goes to the NewerVersionNotice and clears its closed state, so the notice shows again. | REQ-49 | INT-7 |

Notes for the implementer:

- The launch check keeps its behaviour: one check per start, nothing shown on failure. Only the user's check can run another one.
- The user's check keeps the rules of checkLatestRelease: no credentials, no data about the user or the sessions.
- The popup stays open after the check, whatever the result. The notice shows under the popup and is visible when the popup closes.
- The section keeps its result while the popup is open. A new opening starts with no result.
- "View Release" opens the release page like the link of the notice: a new tab in the browser, the system browser in the desktop app.
- Tests use `AI_CLIENT_RELEASE_SOURCE_URL` to point the check at a fixture source. No test needs the desktop window.

## Texts

| Where | Text |
|-------|------|
| Installed version | "Installed version: v<installed>". Hidden while the version is unknown |
| Button | "Check for Updates"; "Checking…" while the check runs |
| Up to date | "You are up to date (v<installed>)" |
| Newer version | "Version <newer> is available. You have <installed>." and the link "View Release" |
| Failure | "Could not check for updates. Try again later." |

## Human acceptance

### Scenario: The user finds a newer version from the settings

- REQ → REQ-43, REQ-44, REQ-45, REQ-46, REQ-48, REQ-49, REQ-51
- Given → a newer release exists, and the user closed the "Update Available" notice
- When → the user opens the "Updates" tab after "Shortcuts" and chooses "Check for Updates"
- Then → the button reads "Checking…" and is disabled, then the tab shows both versions and "View Release", with the popup still open
- And → after the popup closes, the "Update Available" notice shows again

### Scenario: The client is up to date

- REQ → REQ-47
- Given → no newer release exists
- When → the user chooses "Check for Updates"
- Then → the tab shows "You are up to date (v<installed version>)"

### Scenario: GitHub does not answer

- REQ → REQ-50, REQ-52
- Given → the release source does not answer
- When → the user starts the client, then chooses "Check for Updates" in the "Updates" tab
- Then → at launch nothing about updates shows, and the tab shows "Could not check for updates. Try again later."
