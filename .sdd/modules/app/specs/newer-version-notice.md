---
module: app
component: NewerVersionNotice
type: UI component
---

# NewerVersionNotice

**Purpose** → tells the user that a newer version exists, with a link to its release page.

## Contract

Props:
- `version` → the `NewerVersion` of useNewerVersion.
- `onClose()` → called by the close button.

Shows:
- a `role="status"` `.vx-glass` box named "Update Available". It is fixed 12 px under the top bar and 20 px from the right edge of the window, above the page (z-index 50) and below the popovers and the dialogs. It looks like the NeedsInputSnackbar: padding 8 × 14 px, 8 px radius, mono 12/16 px in `--text-primary`.
- the title "Update Available", in bold (mono 500).
- the text "Version <newerVersion> is available. You have <installedVersion>."
- the link "View Release" to `releaseUrl`, with `target="_blank"` and `rel="noopener noreferrer"`. Text link in `--accent-primary`, underlined on hover.
- the icon button "Close Update Notice" (X icon).

Actions:
- "View Release" → the browser opens the release page in a new tab. The desktop window sends it to the system browser.
- "Close Update Notice" → `onClose()`.

## Rules and invariants

- It takes no focus when it appears.
- It may cover part of the main area. It moves no other element.
- The box is never wider than the window minus 40 px, and at most 320 px wide.

## Dependencies

- useNewerVersion (`NewerVersion` type), IconSet (`XIcon`), WebEntry (`.vx-glass`)
- DesktopApp (module desktop): web addresses opened with a target go to the system browser

## Requirements served

- `plan-update_check/REQ-5`, `plan-update_check/REQ-6`, `plan-update_check/REQ-7`
