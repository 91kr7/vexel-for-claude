---
slug: wsl_support
date: 2026-11-13
spec: .sdd/analysis/wsl_support.md
status: validated
---

# Requirements — Port the WSL support branch to main

Words used below, as in the spec:

- "The branch" → `feature/wsl-support`, forked from main before release 0.3.0.
- "Ended external entry" → the list entry of an external session that disappeared. It sits in the ended group, like an ended hosted entry.
- "Look" → the visual style of the client: the "current look" of main today, or the "Windows 11 look". A look is not a theme. The light and dark themes stay, and each look has both.
- "Look switch" → the new control of the top bar that changes the look.
- "macOS buttons" → the red, yellow and green window buttons of `plan-mac_title_bar`.
- "Windows-style buttons" → the minimize, maximize/restore and close buttons of the Windows 11 look.
- "The log" → the log the app already writes for its own messages.

## Feature: Failed system notifications

| ID | Requirement |
|----|-------------|
| REQ-1 | When a system notification fails, the app writes one line to its log that names the reason. |
| REQ-2 | Consecutive failures with the same reason give one log line only. |
| REQ-3 | A failure with a reason different from the previous failure writes a new log line. |
| REQ-4 | The first failure after a notification that succeeded writes a new log line. |
| REQ-5 | A failed notification does not stop or slow the app: the tray, the snackbar and the session list keep working. |
| REQ-6 | Where a notification service exists, every requirement of `plan-session_notifications` stays true. |

## Feature: Ended external sessions

| ID | Requirement |
|----|-------------|
| REQ-7 | When an external session disappears, for example because its terminal closed, the list keeps it as an ended entry in the ended group. |
| REQ-8 | An ended external entry stays in the list until the user dismisses or resumes it, as long as the app's server keeps running. |
| REQ-9 | An ended external entry offers "Dismiss", with the rules of `plan-session_list_improvements/REQ-4` to `REQ-7`. |
| REQ-10 | An ended external entry offers "Resume", with the rules of `plan-session_list_improvements/REQ-2` and `REQ-8` to `REQ-12`. |
| REQ-11 | "Resume here" on an ended external session does not show the running-elsewhere warning. |
| REQ-12 | When the user resumes an ended external session in the client, the ended external entry leaves the list and only the new hosted entry stays. |
| REQ-13 | On an open ended external session, the keyboard shortcuts do what its buttons do. |
| REQ-14 | An external session that ends shows no system notification. |
| REQ-15 | An ended external entry keeps the client name and the favorite mark of its session. |

## Feature: Windows 11 look

| ID | Requirement |
|----|-------------|
| REQ-16 | The client offers two looks: the current look and the Windows 11 look. |
| REQ-17 | The look does not depend on the theme, and each look works in the light theme and in the dark theme. |
| REQ-18 | The top bar shows a look switch next to the theme switch. |
| REQ-19 | The look switch shows the active look and has an accessible name. |
| REQ-20 | Changing the look applies to the whole client at once, without a reload. |
| REQ-21 | Changing the look does not interrupt sessions, close dialogs, or lose the open session or the scroll position. |
| REQ-22 | The client remembers the look across page reloads and client restarts. |
| REQ-23 | The client shows the remembered look from the first frame, with no flash of the other look. |
| REQ-24 | On first start, the client shows the current look. |
| REQ-25 | The Windows 11 look uses Mica-like surfaces and the Windows accent blue. |
| REQ-26 | The Windows 11 look uses the Segoe UI font, and the next sans-serif font of its font list when Segoe UI is not installed. |
| REQ-27 | The Windows 11 look uses corners of 4px on small controls and 8px on larger surfaces such as dialogs and popovers. |
| REQ-28 | In the desktop app, the Windows 11 look shows Windows-style minimize, maximize/restore and close buttons at the right end of the title bar, in place of the macOS buttons. |
| REQ-29 | The Windows-style close button closes the window to the tray. |
| REQ-30 | The Windows-style minimize button minimizes the window. |
| REQ-31 | The Windows-style maximize/restore button maximizes the window, and restores it when it is maximized. |
| REQ-32 | Drag and double click on the title bar work in both looks, as `plan-mac_title_bar/REQ-6` to `REQ-8` require. |
| REQ-33 | The top bar keeps an empty area to drag at every window width, with the look switch in it. |
| REQ-34 | The current look stays exactly as on main today, macOS buttons included. |
| REQ-35 | The client opened in a browser shows no window buttons in either look. |
| REQ-36 | Text meets WCAG 2.2 AA contrast in all four combinations of look and theme. |
| REQ-37 | The accent blue changes tone only where it needs it to reach the contrast of REQ-36. |
| REQ-38 | In the Windows 11 look, the status colours of working, needs input, error, waiting and ended stay easy to tell apart. |
| REQ-39 | The look switch and the Windows-style buttons work with the keyboard, with a visible focus. |
| REQ-40 | Each Windows-style button has an accessible name that says its action. |

## Feature: Lock file

| ID | Requirement |
|----|-------------|
| REQ-41 | `package-lock.json` carries the same license as `package.json`, with no dependency version changed. |

## Assumptions

All come from the spec, unless marked as a gatekeeper decision. The gatekeeper validated REQ-1 to REQ-41 on 2026-11-13.

- **Environment.** WSL means a Linux distribution under WSL 2, with the desktop app shown through WSLg. The app stays a Linux app.
- **Dismissed entry (REQ-9).** A dismissed ended external entry does not come back as an ended entry. Gatekeeper decision: when the same conversation later runs again in a terminal, it shows as a live external entry, like any external session.
- **Lifetime (REQ-8).** Gatekeeper decision: an ended external entry lives in the server memory, like an ended hosted entry today. It does not survive a restart of the app's server. The branch has no persistence, and the port adds none.
- **Keyboard use of Dismiss and Resume (REQ-9, REQ-10).** Gatekeeper decision: on an ended external entry they work with the keyboard as on an ended hosted entry (`plan-session_list_improvements/REQ-13`).
- **Log line in the acceptance scenarios (REQ-1 to REQ-4).** Gatekeeper decision: the log line is the result the spec asks for. Its scenarios read it in the terminal output of the app started from a shell. This is an exception to `human-acceptance.md`.
- **Resume paths (REQ-12).** "Resumes in the client" covers "Resume" on the entry, "Resume here" and a resume from the history.
- **Accent blue (REQ-25).** It is the Windows 11 default accent. The client does not read the user's Windows accent colour.
- **Mica-like (REQ-25).** Surfaces drawn with the client's own colours. They take no tint from the Windows wallpaper.
- **Look storage (REQ-22).** The client remembers the look where the user chose it, as it does for the theme (`plan-light_theme`).
- **Terminal panel.** The terminal panel of hosted sessions stays dark in both looks.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- Main gets the four features above, and no other change from the branch.
- Every behaviour of main today keeps working, including the features of release 0.3.0 such as `plan-project_list_actions`.
- Every requirement of the earlier plans stays true, with two changes the spec accepts: `plan-session_list_improvements/REQ-3` now also allows Dismiss and Resume on ended external entries (REQ-9, REQ-10), and `plan-mac_title_bar/REQ-15` holds in the current look only (REQ-28).
- The client marks an external session as ended only in the client. It writes nothing to an external session.
- The app does not bundle Segoe UI.
- Every new text of the UI is in English.
- Out of scope: a native Windows build or installer; detecting WSL or choosing the look from the operating system; real Mica, the user's Windows accent colour or wallpaper; another way to deliver notifications under WSL; a setting to turn notifications off; automatic removal of ended external entries, removing several at once, undo of a dismiss; any change to the current look, its themes or the layout; looks other than the current one and Windows 11.
