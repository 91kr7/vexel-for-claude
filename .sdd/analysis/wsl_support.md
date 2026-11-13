---
request_slug: wsl_support
date: 2026-11-13
type: new
size: ordinary
reference: none
---

# Analysis — Port the WSL support branch to main

## Request

> è stata fatta una fix per far funzionare wsl. presente nella branch feature/wsl-support.
> provvedi a portare queste fix su main.

Human decision of 2026-11-13: "porta tutta la branch ma analizza cosa stai portando per capire se va bene!" The whole branch is in scope, not only its WSL part.

## Summary

Bring to main the four changes of `feature/wsl-support`: quiet failed notifications, ended external sessions that stay in the list, a Windows 11 look with its own switch, and a lock file sync. The app must work under WSL, and every behaviour of main today must keep working.

## Requirements

### Functional

Port
- Main must get the four changes below, and no other change from the branch.
- Every behaviour of main today must keep working, including the features added after the branch started, such as the project list actions of release 0.3.0.

Failed system notifications
- When a system notification fails, the app must write one line to its log that names the reason.
- Consecutive failures with the same reason must give one log line only. A new line must appear when the reason changes, or at the next failure after a notification that succeeded.
- A failed notification must not stop or slow the app. The tray, the snackbar and the session list must keep working.
- Where a notification service exists, notifications must behave as in [session_notifications.md](session_notifications.md).

Ended external sessions
- When an external session disappears, for example because its terminal closed, the list must keep it as an ended entry in the ended group.
- An ended external entry must offer "Dismiss" and "Resume", with the rules of [session_list_improvements.md](session_list_improvements.md), lines 39-48.
- "Resume here" on an ended external session must not show the running-elsewhere warning.
- When the user resumes an ended external session in the client, the ended external entry must leave the list. Only the new hosted entry stays.
- On an open ended external session, the keyboard shortcuts must do what its buttons do.
- An external session that ends must show no system notification, as today.
- An ended external session must keep its client name and favorite mark.

Windows 11 look
- The client must offer two looks: the current look and a Windows 11 look.
- The look must be independent of the theme. Each look must work in light and in dark.
- The top bar must show a look switch next to the theme switch.
- The look switch must show the active look and have an accessible name.
- Changing the look must apply to the whole client at once, without a reload.
- Changing the look must not interrupt sessions, close dialogs, or lose the open session or the scroll position.
- The client must remember the look across reloads and restarts, and show it from the first frame with no flash of the other look.
- The Windows 11 look must use Mica-like surfaces, the Windows accent blue, the Segoe UI font, and corners of 4px and 8px.
- In the desktop app, the Windows 11 look must show Windows-style minimize, maximize/restore and close buttons at the right end of the title bar, in place of the macOS buttons.
- These buttons must act as the macOS buttons do: close to the tray, minimize, maximize or restore ([mac_title_bar.md](mac_title_bar.md), lines 40-42).
- Drag and double click on the title bar must work in both looks.
- The top bar must keep an empty area to drag at every window width, with the new switch in it.
- The current look must stay exactly as on main today, macOS buttons included.
- The client opened in a browser must show no window buttons in either look.

Lock file
- `package-lock.json` must carry the same license as `package.json`, with no change of dependency versions.

### Non-functional

- Text must meet WCAG 2.2 AA contrast in all four combinations of look and theme. The accent blue gets a darker or lighter tone only where needed to reach it.
- Status colours (working, needs input, error, waiting, ended) must stay distinguishable in the Windows 11 look.
- The look switch and the Windows-style buttons must work with the keyboard, with a visible focus. Each button must have an accessible name that says its action.

## Assumptions

- The type is new. No earlier analysis covers WSL, and the branch touches four of them: [session_notifications.md](session_notifications.md), [session_list_improvements.md](session_list_improvements.md), [light_theme.md](light_theme.md), [mac_title_bar.md](mac_title_bar.md).
- WSL means a Linux distribution under WSL 2 on Windows, with the desktop app shown through WSLg. The app stays a Linux app. This widens the environment of [desktop_app.md](desktop_app.md) line 66. It adds no native Windows build.
- By porting the whole branch, the human accepts that it reverses two earlier scope decisions. These are Dismiss and Resume for external sessions ([session_list_improvements.md](session_list_improvements.md), lines 38 and 104) and a visual variant beyond light and dark ([light_theme.md](light_theme.md), line 75).
- An ended external entry follows the rules of an ended hosted entry. It stays until the user dismisses or resumes it, and a dismissed entry does not come back.
- On first start, the look is the current look. The app does not detect WSL and does not choose the look by itself.
- The client remembers the look where the user chose it, like the theme ([light_theme.md](light_theme.md), line 62).
- The terminal panel of hosted sessions stays dark in both looks, as in both themes today.
- 4px is the corner of small controls, and 8px the corner of larger surfaces such as dialogs and popovers.
- The accent blue is the Windows 11 default accent. The client does not read the user's own Windows accent colour.
- "Mica-like" means surfaces drawn with the client's own colours. Real Mica takes its tint from the Windows wallpaper ([Mica material](https://learn.microsoft.com/windows/apps/design/style/mica)), which a Linux window does not get.
- When Segoe UI is not installed on the machine, the Windows 11 look uses the next sans-serif font of its font list.

## Constraints

- The app must not bundle Segoe UI. Microsoft states it is "exclusively included with Microsoft products and services" ([Segoe UI font family](https://learn.microsoft.com/typography/font-list/segoe-ui)).
- Marking an external session as ended happens only in the client. The client still writes nothing to an external session ([claude_sessions_client.md](claude_sessions_client.md), line 80).

## Risks

- The client can mark an external session as ended while its terminal still runs, for example when a scan misses it under WSL. "Resume here" then gives no warning, and two writers on one conversation can corrupt it ([claude_sessions_client.md](claude_sessions_client.md), line 123).
- Every closed terminal now leaves an ended entry. The list can fill up, and Dismiss removes only one entry at a time.
- Without a notification service, the user under WSL gets no system notification. Only the in-app signals and the tray, if shown, remain.
- The branch started before release 0.3.0. Its changes can break the features that main gained since then.
- Linux under WSL may not see the fonts installed on Windows. The Windows 11 look then shows its fallback font, not Segoe UI.

## Scope

In scope:
- The one-line, once-per-reason log of failed system notifications.
- Ended external sessions kept in the list, with Dismiss, Resume and "Resume here" without warning.
- The Windows 11 look, its switch in the top bar, and the Windows-style window buttons of the desktop app.
- The license sync of `package-lock.json`.

Out of scope:
- A native Windows build or installer.
- Detecting WSL, or choosing the look from the operating system.
- Real Mica, the user's Windows accent colour, or the Windows wallpaper.
- Bundling Segoe UI.
- Another way to deliver notifications under WSL, and a setting to turn notifications off.
- Automatic removal of ended external sessions, removing several at once, and undo of a dismiss.
- Any change to the current look, its light and dark themes, or the layout.
- Looks other than the current one and Windows 11.
