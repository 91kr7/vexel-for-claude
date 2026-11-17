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
- a `role="status"` `.vx-glass` box named "Update Available". It is fixed 12 px under the top bar and 20 px from the right edge of the window, above the page (z-index 50) and below the popovers and the dialogs. It looks like the NeedsInputSnackbar: padding 8 × 14 px, `--radius-frame`, 1 px `--role-border-strong` border, top line and `--shadow-frame`, mono 12/16 px in `--text-primary`.
- the title "Update Available", in bold (mono 500).
- the text "Version <newerVersion> is available." and, on a new line, "You have <installedVersion>."
- the changelog area, under that text, only when `changelogs` has at least one entry. One block per entry, in the given order (newest first), each named and headed "Version <version>" (heading in mono 500), then its `text` through ChangelogText. An entry without `text` shows the heading alone.
- the link "View Release" to `releaseUrl`, with `target="_blank"` and `rel="noopener noreferrer"`. Text link in `--accent-primary`, underlined on hover.
- the icon button "Close Update Notice" (X icon).

Actions:
- "View Release" → the browser opens the release page in a new tab. The desktop window sends it to the system browser.
- "Close Update Notice" → `onClose()`.

Motion (MotionTokens):
- on open → it slides up a few pixels from below on the spring curve while it fades in. "Close Update Notice" and "View Release" work from the first frame of the effect.
- leaving (`useLeaving()` of ExitPresence is `true`) → the reverse: it slides down while it fades out. The leaving notice:
  - takes no pointer input: clicks reach the page below;
  - "Close Update Notice" does nothing;
  - is hidden from assistive technologies (`aria-hidden`).
- reduced motion → no slide and no fade: it appears and goes at once.

## Rules and invariants

- It takes no focus when it appears.
- It may cover part of the main area. It moves no other element.
- The box is never wider than the window minus 40 px, and at most 320 px wide.
- The box is never taller than the window below the top bar minus 24 px. Past that height only the changelog area scrolls: the title, the two versions, "View Release" and "Close Update Notice" stay visible at any changelog length.
- No changelogs, or an empty list → the box is the same as before the changelogs existed.

## Dependencies

- useNewerVersion (`NewerVersion` type), ChangelogText, IconSet (`XIcon`), WebEntry (`.vx-glass`)
- MotionTokens, ExitPresence (`useLeaving`)
- DesktopApp (module desktop): web addresses opened with a target go to the system browser, changelog links included

## Requirements served

- `plan-update_check/REQ-5`, `plan-update_check/REQ-6`, `plan-update_check/REQ-7`
- `plan-release_changelog/REQ-7`, `plan-release_changelog/REQ-8`, `plan-release_changelog/REQ-9`, `plan-release_changelog/REQ-12`, `plan-release_changelog/REQ-13`, `plan-release_changelog/REQ-14`, `plan-release_changelog/REQ-15`
- `plan-dark_blue_theme/REQ-3`
- `plan-ui_transitions/REQ-3`, `plan-ui_transitions/REQ-4`, `plan-ui_transitions/REQ-26`
