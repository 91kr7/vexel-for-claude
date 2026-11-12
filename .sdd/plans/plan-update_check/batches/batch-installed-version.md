---
batch: installed-version
feature: Installed version in the top bar
closed_req: [REQ-13, REQ-14, REQ-15]
depends: [newer-version-notice]
---

# Batch — installed-version

Requirements: `.sdd/plans/plan-update_check/requirements.md`.

## Decisions for this batch

- **Source.** The server gives the installed version on a new route under `/api`. It is the same value that the server passes to the release check: `version` of `package.json`, read at start. So the top bar and the notice show the same number (REQ-14).
- **No wait.** The new route answers at once. It never waits for the release check. `GET /api/newer-version` stays as it is, because it waits for the check (REQ-15).
- **No network.** The page asks only its own local server. Nothing in this batch calls GitHub (REQ-15).
- **Form.** The top bar shows `v` followed by the installed version, for example `v0.2.2` (REQ-13). The notice keeps its text without the `v`, for example "You have 0.2.2." (gatekeeper decision). The certified batch newer-version-notice does not change.
- **Place and look.** The version sits right after "for Claude", 8 px apart, on the same baseline. Same style as "for Claude": mono 10 px, `--text-muted`. It is text, not a control. In the desktop window it stays in the drag area.
- **Loading.** The page asks for the version once per mount. Until the answer arrives, or if the request fails, the top bar shows no version text and keeps its layout.
- **Tests never call the real GitHub.** `playwright.config.ts` already sets `AI_CLIENT_RELEASE_SOURCE_URL` to a local address for every e2e server (batch-newer-version-notice/INT-8). This batch adds no new setting. Unit tests use no network.
- **Electron e2e** of this batch go in the Electron group (`npm run test:e2e:desktop`), never in the default e2e run.

## What this batch builds

- **Installed version route** → gives the page the installed version at once.
- **Installed version loader** → loads that version once when the page mounts.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | backend, module app | Installed version route under `/api`: answers at once with the installed version given by its caller. It never waits for the release check. | REQ-14, REQ-15 | — |
| INT-2 | modify | `src/server/main.ts` | Registers the route of INT-1 with the same installed version that it passes to checkLatestRelease. | REQ-14, REQ-15 | INT-1 |
| INT-3 | create | frontend, module app | Installed version loader: asks the route of INT-1 once per page mount. Gives the version, or nothing while loading and on failure. | REQ-13, REQ-15 | INT-1 |
| INT-4 | modify | `src/web/TopBar.tsx` | Shows `v<version>` from the loader of INT-3 right after "for Claude", as plain text in the drag area. Shows nothing while there is no version. | REQ-13 | INT-3 |

## Human acceptance

### Scenario: The user sees the installed version in the top bar

- REQ → REQ-13
- Given → version 0.2.2 is installed
- When → the user launches the desktop app
- Then → the top bar shows "Vexel for Claude v0.2.2"
- And → the user opens the same server in a browser tab, and its top bar shows "Vexel for Claude v0.2.2" too

### Scenario: The top bar and the notice show the same version

- REQ → REQ-14
- Given → version 0.2.2 is installed, and the release source gives a published release `v0.3.0`
- When → the user launches the application
- Then → the top bar shows `v0.2.2`
- And → the notice shows "Version 0.3.0 is available. You have 0.2.2."

### Scenario: The version shows without network

- REQ → REQ-15
- Given → version 0.2.2 is installed, and the machine has no network
- When → the user launches the application
- Then → the top bar shows `v0.2.2`, and no notice appears

### Scenario: The version does not wait for the check

- REQ → REQ-15
- Given → version 0.2.2 is installed, and the release source is a local fake that waits 8 s before it answers `v0.3.0`
- When → the user launches the application
- Then → the top bar shows `v0.2.2` as soon as the session list appears
- And → the notice shows only after the fake answers
