---
batch: needs-input-sound
feature: Needs-input sound
closed_req: REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9
depends: —
---

# Batch — Needs-input sound

The desktop app plays a short sound when a hosted or external session enters "needs input", whatever the state of the window.

## What this batch builds

- **Sound rule** (desktop area, next to the notification rules) → decides when an attention event plays the sound.
- **The sound** (web frontend, next to the page side of the desktop bridge) → the short sound itself.
- **Sound player** (web frontend, same area) → plays the sound in the page of the desktop window on each request of the desktop app.

## Decisions

- **The source is the attention events.** The AttentionMonitor (module sessions) gives one `needs_input` event for each entry into "needs input". It gives none at first sight, so none for a state from before the app started. It gives none while a session keeps needing input. The sound rule reuses this, so REQ-5, REQ-6 and REQ-7 need no new logic in the backend.
- **5-second window.** One window over every `needs_input` event, of any session. The rule plays when no sound played in the last 5000 ms (`requirements.md`, assumption "REQ-4 and REQ-6 together"). Time comes from an injected clock, like NotificationRules.
- **Focus is not an input.** NotificationRules drop events while the window has the focus. The sound rule gets every event before that check, so the sound also plays with the focus (REQ-2).
- **The page plays the sound.** The Electron main process has no audio API. The desktop app sends a sound request to the page of its window through the DesktopBridge, and the page plays it. A hidden or minimized window keeps its page loaded (DesktopApp), so the sound also plays there. Electron's default autoplay policy needs no user gesture. If a hidden page cannot play, the developer reports it and does not improvise another channel.
- **Browser.** A browser has no DesktopBridge, so it never gets a sound request and plays nothing.
- **Page not loaded yet.** An event that comes while the page loads, in the first seconds after the backend start, plays no sound. Its notification still shows.
- **Sound.** One short chime of at most 2 s, at a moderate level, made for this app. A third-party file is allowed only under a licence that allows bundling it, and then it is listed in `THIRD-PARTY-NOTICES.md`.
- **No wait.** The player starts the sound and does not wait for its end. A failed play is ignored, so the UI never blocks (REQ-9).
- **Notifications and tray stay as they are.** NotificationRules, SystemNotifications and TrayIcon do not change.
- **Ubuntu.** The sound plays through the page, the same way on Ubuntu and WSL. Nothing of the Ubuntu desktop behaviour changes (knowledge base `wsl-keeps-ubuntu-working`).
- **Tests.** Vitest for the sound rule (kinds, repeated ids, 5-second window) and for the player (one play per request, not awaited, a failed play ignored). The check that an event plays the sound in the desktop window, with the window focused and hidden, goes in the Electron e2e group (knowledge base `electron-e2e-separate`). The default browser e2e run checks that the page plays nothing.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | desktop area, next to the notification rules | Sound rule: "play" for a `needs_input` event with a new id when no sound played in the last 5000 ms. Never for `turn_end` or `session_end`. No Electron API. | REQ-1, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8 | — |
| INT-2 | modify | `src/desktop/desktop-bridge.cts` | Add a listener for the sound requests that DesktopApp sends on a new IPC channel, with an unsubscribe, like `onOpenSession`. | REQ-1 | — |
| INT-3 | modify | `src/desktop/main.ts` | Pass each AttentionClient event to the sound rule, whatever the window focus. On "play", send the sound request to the page of the window. | REQ-1, REQ-2, REQ-3 | INT-1, INT-2 |
| INT-4 | modify | `src/web/desktop-bridge.ts` | Pass on the sound requests of the bridge to a page listener while it is subscribed. No bridge, or a bridge without it → nothing. | REQ-1 | INT-2 |
| INT-5 | create | web frontend, next to the page side of the desktop bridge | The sound (decision "Sound"). | REQ-9 | — |
| INT-6 | create | web frontend, same area | Sound player: on each sound request, start the sound without waiting for its end. A failed play is ignored. | REQ-1, REQ-2, REQ-9 | INT-4, INT-5 |
| INT-7 | modify | `src/web/AppLayout.tsx` | Mount the sound player once for the page. | REQ-1 | INT-6 |

The developer updates the specs of DesktopBridge, DesktopApp, useDesktopBridge and AppLayout. They write the specs of the sound rule, the sound and the sound player, and update the indexes.

## Human acceptance

### Scenario: A sound plays when Claude asks for a permission

- REQ → REQ-1, REQ-2, REQ-3, REQ-9
- Given → the desktop app runs, and its window has the focus on a hosted session
- When → the user sends a prompt that makes Claude ask for a tool permission
- Then → within 5 seconds a short sound plays, and the window reacts to clicks while it plays

### Scenario: The sound plays with the window closed to the tray

- REQ → REQ-1, REQ-2
- Given → the window is closed to the tray, and an external session runs in a terminal
- When → the user sends a prompt in that terminal that makes Claude ask a question
- Then → a short sound plays
- And → the needs-input notification shows as before

### Scenario: Two sessions that start to wait together play one sound

- REQ → REQ-4, REQ-5
- Given → two sessions work on prompts that each end in a permission request
- When → both sessions ask for their permission within 5 seconds
- Then → one sound plays, and no other sound plays while the two sessions keep waiting

### Scenario: A new question plays the sound again

- REQ → REQ-6
- Given → a session needs input, and its sound played more than 5 seconds ago
- When → the user grants the permission, and Claude asks for another one more than 5 seconds after the first sound
- Then → the sound plays again

### Scenario: No sound for a session that already waited

- REQ → REQ-7
- Given → the desktop app is not running, and a session in a terminal needs input
- When → the user starts the desktop app
- Then → no sound plays, and the tray shows the waiting session as before

### Scenario: No sound at the end of a turn

- REQ → REQ-8
- Given → the window is in the background, and a hosted session works on a prompt
- When → Claude finishes the turn
- Then → the turn-end notification shows, and no sound plays
