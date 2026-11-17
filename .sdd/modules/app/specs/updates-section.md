---
module: app
component: UpdatesSection
type: UI component
---

# UpdatesSection

**Purpose** → the "Updates" section of the settings popup: the installed version and a manual release check.

## Contract

Props:
- `onNewerVersion(version)` → called with the `NewerVersion` of a check that finds a newer version.
- `check` → optional, the check to run. Default: checkForUpdates.

Description:
- the body of the "Updates" menu of the SettingsDialog: one card named "Updates" (`--radius-card`, `--role-card`, 1 px `--role-border-subtle` border). Its first line has the installed version on the left and the button on the right; after a check, the result shows under them, inside the same card.

Shows:
- "Installed version: v<installed>", with the version of useInstalledVersion. Hidden while the version is unknown.
- the button "Check for Updates".
- while the check runs → the button reads "Checking…" and is disabled. No result shows.
- result `current` → "You are up to date (v<installedVersion>)", with the version of the answer.
- result `newer` → "Version <newerVersion> is available. You have <installedVersion>." and the link "View Release" to `releaseUrl`, with `target="_blank"` and `rel="noopener noreferrer"`.
- result `failed` → the ErrorMessage "Could not check for updates. Try again later."
- the result texts `current` and `newer` are in a `role="status"` element, so a screen reader announces them.

Actions:
- "Check for Updates" → one `check`. When it ends, the button reads "Check for Updates" again and is enabled, and the result shows. A new check replaces the shown result.
- a `newer` result → `onNewerVersion(version)` once, as well as the text in the section.
- "View Release" → the browser opens the release page in a new tab. The desktop window sends it to the system browser.

## Rules and invariants

- It keeps its result while it stays mounted. A new mount starts with no result.
- Unmount during a check → the check is aborted; a late answer changes nothing and calls no `onNewerVersion`.
- It never closes the popup.

## Dependencies

- checkForUpdates, useInstalledVersion, useNewerVersion (`NewerVersion` type), ErrorMessage
- DesktopApp (module desktop): web addresses opened with a target go to the system browser

## Requirements served

- `plan-settings_dialog/REQ-44`, `plan-settings_dialog/REQ-46`, `plan-settings_dialog/REQ-47`, `plan-settings_dialog/REQ-48`, `plan-settings_dialog/REQ-50`, `plan-settings_dialog/REQ-51`, `plan-settings_dialog/REQ-60`
- `plan-dark_blue_theme/REQ-3`
