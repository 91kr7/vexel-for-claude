---
batch: newer-version-notice
feature: Newer version notice
closed_req: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12]
depends: []
---

# Batch — newer-version-notice

Requirements: `.sdd/plans/plan-update_check/requirements.md`.

## Decisions for this batch

- **Launch.** A launch is the start of the server. The desktop app starts the server, so its launch is a server start too. The server runs the check once, and every page of that launch reads its result (REQ-2).
- **Desktop app that reuses a running server.** It shows the result of the check of that server's start. It runs no new check.
- **Source.** The check asks the GitHub endpoint for the latest release of the repository. That endpoint already leaves out drafts and pre-releases (REQ-3). Owner and name of the repository come from `repository.url` of `package.json`.
- **Installed version** → `version` of `package.json`.
- **Comparison** → `MAJOR.MINOR.PATCH`, a leading `v` ignored. Only a strictly higher release is newer. A tag in any other form is never newer.
- **Failure** → no answer, a refusal, a time-out or an unreadable answer all give "no newer version" (REQ-9). The page shows nothing about it.
- **Request** → a plain GET with Node's built-in `fetch`, with no credentials and no data about the user or the sessions (REQ-12). It has a time limit of 10 s. No new dependency.
- **Tests never call the real GitHub.** An environment variable replaces the address of the release source. The default is the GitHub API. The implementer names the variable and records it in the Server spec.
- **Close.** Closing the notice hides it only in the open page. A reload or a new tab shows it again from the same result (gatekeeper decision).
- **Look.** A glass box fixed at the top right of the main area, under the top bar, styled like the NeedsInputSnackbar. It covers part of the main area and moves no other element. It does not take the focus.
- **Text (English):** title "Update Available", body "Version <newer> is available. You have <installed>.", link "View Release", close icon button labelled "Close Update Notice".
- **Link.** It opens with a target. The browser page opens it in a new tab. The desktop window already sends such `http`/`https` links to the system browser (DesktopApp spec), so no desktop code changes.
- **Electron e2e** of this batch go in the Electron group (`npm run test:e2e:desktop`), never in the default e2e run.

## What this batch builds

- **Version rule** → tells whether a release tag is newer than the installed version.
- **Release check** → the one request to GitHub at launch, and its result.
- **Newer version route** → gives the page the result of the launch's check.
- **Newer version loader** → loads that result once when the page mounts.
- **Newer version notice** → the box with the two versions, the link and the close button.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | backend, module app | Version rule: compares a release tag with the installed version as `MAJOR.MINOR.PATCH`, leading `v` ignored. Newer only when strictly higher; any other tag form is never newer. | REQ-4 | — |
| INT-2 | create | backend, module app | Release check: one GET for the latest release of the repository, no credentials, 10 s limit, source address given by its caller. Result → installed version, newer version and release page address; else "none" on any failure. | REQ-1, REQ-3, REQ-9, REQ-12 | INT-1 |
| INT-3 | create | backend, module app | Newer version route under `/api`: answers with the result of the launch's check, waiting for it while it runs. It never starts a check. | REQ-2, REQ-9 | INT-2 |
| INT-4 | modify | `src/server/main.ts` | At start, runs the Release check once, without waiting for it before the listen. Source address from a new environment variable, default the GitHub API. Registers the route of INT-3 with that result. | REQ-1, REQ-2, REQ-10, REQ-11 | INT-2, INT-3 |
| INT-5 | create | frontend, module app | Newer version loader: asks the route of INT-3 once per page mount, in the background. A failed request gives no notice. | REQ-9, REQ-11 | INT-3 |
| INT-6 | create | frontend, module app | Newer version notice: shows the installed and the newer version, the "View Release" link with a target, and the close button. | REQ-5, REQ-6, REQ-7 | — |
| INT-7 | modify | `src/web/AppLayout.tsx` | Shows the notice while the loader gives a newer version and the user has not closed it in this page. Close state lives only in the page. | REQ-4, REQ-7, REQ-8, REQ-10 | INT-5, INT-6 |
| INT-8 | modify | `playwright.config.ts` | Enabling: sets the variable of INT-4 for every e2e server, browser and Electron groups, to a local address. No e2e run calls GitHub. | — | INT-4 |

## Human acceptance

### Scenario: The user sees that a newer version exists

- REQ → REQ-1, REQ-4, REQ-5, REQ-10, REQ-11
- Given → version 0.1.0 is installed, and GitHub has a published release `v0.2.0`
- When → the user launches the desktop app
- Then → the session list appears as usual
- And → a notice "Update Available" shows "Version 0.2.0 is available. You have 0.1.0."

### Scenario: The user opens the release page

- REQ → REQ-6, REQ-10
- Given → the notice is shown in the desktop window
- When → the user clicks "View Release"
- Then → the release page of `v0.2.0` opens in the system browser, and the client window stays on its page

### Scenario: The user closes the notice

- REQ → REQ-7
- Given → the notice is shown
- When → the user clicks "Close Update Notice"
- Then → the notice disappears, and the rest of the page does not change

### Scenario: A closed notice comes back at the next launch

- REQ → REQ-8
- Given → the user closed the notice, and `v0.2.0` is still the latest release
- When → the user quits the application and launches it again
- Then → the notice shows again with the same two versions

### Scenario: A reload shows the result of the same launch

- REQ → REQ-2
- Given → the application started while `v0.2.0` was the latest release, and `v0.3.0` was published afterwards
- When → the user reloads the browser page
- Then → the notice shows "Version 0.2.0 is available", not 0.3.0

### Scenario: No notice without a newer published release

- REQ → REQ-3, REQ-4
- Given → the latest published release is `v0.1.0`, the installed version, and a pre-release `v0.2.0-rc.1` exists
- When → the user launches the application
- Then → no notice appears

### Scenario: GitHub cannot be reached

- REQ → REQ-9, REQ-11
- Given → the machine has no network
- When → the user launches the application
- Then → the session list appears as usual, with no notice and no error message

### Scenario: The request carries nothing about the user

- REQ → REQ-12
- Given → the release source is a local fake that prints each request it receives
- When → the user launches the application
- Then → the printed request has no credentials header, and no user, session or folder data in the address or headers
