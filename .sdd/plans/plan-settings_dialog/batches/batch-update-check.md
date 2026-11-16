---
batch: update-check
feature: Update check in the settings
closed_req: [REQ-43, REQ-44, REQ-45, REQ-46, REQ-47, REQ-48, REQ-49, REQ-50, REQ-51, REQ-52, REQ-53, REQ-54, REQ-55, REQ-56, REQ-57, REQ-58, REQ-59, REQ-60]
depends: [shortcuts-section]
---

# Batch update-check — Update check in the settings

Requirements → `.sdd/plans/plan-settings_dialog/requirements.md`. The settings popup exists, with the tabs "Theme", "Window Look" and "Shortcuts". This batch adds the "Updates" tab, where the user runs the launch release check by hand.

Reopened on 2026-11-16 for a defect of the popup layout (REQ-53 to REQ-60, human decision). INT-1 to INT-8 are done. INT-9 to INT-19 replace the tabs with three menus on the left: "Appearance", "Shortcuts", "Updates".

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
| INT-9 | modify | `src/web/settings/SettingsDialog.tsx` | Replace the tabs with a vertical menu on the left: "Appearance" (ThemeSection, then LookSection), "Shortcuts", "Updates". Up and Down arrows move in the menu. The start prop takes `appearance`, `shortcuts` or `updates`. | REQ-53, REQ-54 | — |
| INT-10 | modify | `src/web/settings/SettingsDialog.tsx` | Fixed frame of 760 × 540 px, each at most the window minus 32 px. The right part has a header with the menu title and an optional action, and a body that scrolls. | REQ-55, REQ-56, REQ-59 | INT-9 |
| INT-11 | modify | `src/web/AppLayout.tsx` | Open the popup on "Appearance" from the settings button and on "Shortcuts" from the settings shortcut, with the new start values of INT-9. | REQ-53 | INT-9 |
| INT-12 | modify | `src/web/settings/ThemeSection.tsx` | The heading "Theme" and two cards "Light" and "Dark", each with the sun or moon icon and a small preview of its colours. The active card has the accent border and a check. Same radio semantics and keys as today. | REQ-57 | INT-17 |
| INT-13 | modify | `src/web/settings/LookSection.tsx` | The heading "Window Look" and two cards "macOS" and "Windows 11", with `MacWindowIcon` and `WindowsLogoIcon`. The active card is marked as in INT-12. Same radio semantics and keys as today. | REQ-57 | INT-17 |
| INT-14 | modify | `src/web/icons/Icons.tsx` | Add the Lucide "rotate-ccw" icon for "Restore Default". | REQ-58 | — |
| INT-15 | modify | `src/web/settings/ShortcutsSection.tsx` | Each row on one line: the action on the left, then the key badges, "Change Keys" (pencil) and "Restore Default" (rotate-ccw) as icon buttons with their accessible names and a tooltip. Group headings stay. | REQ-58 | INT-14, INT-17 |
| INT-16 | modify | `src/web/settings/ShortcutsSection.tsx` | Move "Restore All" to the header action of INT-10. The editing text and the rejection message stay inside the row, under the action. | REQ-58, REQ-59 | INT-10, INT-15 |
| INT-17 | modify | `src/web/styles.css` | Styles of the menu, the right part, the cards, the one-line rows and the update card, with the theme tokens only, so both themes work. | REQ-54, REQ-57, REQ-58, REQ-60 | — |
| INT-18 | modify | `src/web/theme/windows11.css` | The Windows 11 look of the new elements: its surfaces, accent and 4 px and 8 px corners. | REQ-57, REQ-60 | INT-17 |
| INT-19 | modify | `src/web/settings/UpdatesSection.tsx` | One card: the installed version, "Check for Updates" and the result under them, with the same texts as today. | REQ-60 | INT-17 |

Notes for the implementer:

- The launch check keeps its behaviour: one check per start, nothing shown on failure. Only the user's check can run another one.
- The user's check keeps the rules of checkLatestRelease: no credentials, no data about the user or the sessions.
- The popup stays open after the check, whatever the result. The notice shows under the popup and is visible when the popup closes.
- The section keeps its result while the popup is open. A new opening starts with no result.
- "View Release" opens the release page like the link of the notice: a new tab in the browser, the system browser in the desktop app.
- Tests use `AI_CLIENT_RELEASE_SOURCE_URL` to point the check at a fixture source. No test needs the desktop window.
- Layout (INT-9 to INT-19): while you work, build the app and start it on a free port, then take screenshots with a Playwright script. Take every menu, in both themes and both looks, at 1440 × 900 and in a small window. Look at them and change the layout until it is clean. Stop the server you started by its PID only (knowledge base `no-kill-by-pattern`).
- Tests that click the old tabs "Theme" and "Window Look" now use the menu "Appearance".

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
- When → the user opens the "Updates" menu after "Shortcuts" and chooses "Check for Updates"
- Then → the button reads "Checking…" and is disabled, then the menu shows both versions and "View Release", with the popup still open
- And → after the popup closes, the "Update Available" notice shows again

### Scenario: The settings popup shows three menus at a steady size

- REQ → REQ-53, REQ-54, REQ-55, REQ-56, REQ-57, REQ-58, REQ-59, REQ-60
- Given → the client is open in a 1440 × 900 window
- When → the user opens the settings and chooses "Appearance", "Shortcuts" and "Updates" in the menu on the left, one after the other
- Then → the popup keeps its size; "Appearance" shows the theme and look cards with the active ones marked, "Shortcuts" shows "Restore All" in its header and one line per shortcut, and "Updates" shows one card
- And → in a small window the popup still fits, and only its right part scrolls

### Scenario: The client is up to date

- REQ → REQ-47
- Given → no newer release exists
- When → the user chooses "Check for Updates"
- Then → the "Updates" menu shows "You are up to date (v<installed version>)"

### Scenario: GitHub does not answer

- REQ → REQ-50, REQ-52
- Given → the release source does not answer
- When → the user starts the client, then chooses "Check for Updates" in the "Updates" menu
- Then → at launch nothing about updates shows, and the menu shows "Could not check for updates. Try again later."
