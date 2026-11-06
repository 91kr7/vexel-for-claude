---
batch: needs-input-notification
feature: Needs-input notification
closed_req: REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13
depends: —
---

# Batch — Needs-input notification

When a hosted or external session starts to need input, the desktop app shows an urgent system notification. A click opens that session in the window. The notification goes away when the need is gone or the user opens the session.

## What this batch builds

- **Attention monitor** (backend, sessions area) → follows the hosted and external sessions. It gives each event that notifies, and the list of the sessions that need input.
- **Attention route** (backend, sessions area) → WebSocket that sends the monitor's events and list to the desktop app.
- **Attention client** (desktop area) → connects the desktop app to the attention route, and connects again after a drop.
- **Notification rules** (desktop area) → decide which notification to show and which to close. No Electron inside, so Vitest can test them.
- **Notification texts** (desktop area) → the English title and body of each notification.
- **System notifications** (desktop area) → show and close the notifications of the Linux desktop, and report clicks.
- **Desktop bridge** (desktop area) → preload of the window. It lets the page report its open session and receive "open this session".
- **Page side of the desktop bridge** (frontend, app area) → uses the bridge when it exists. In a browser it does nothing.

## Decisions

- **Name.** "Attention" because `/api/sessions/events` and Claude Code's `Notification` hook already name other things.
- **Event.** Unique id, session id, kind (`needs input` in this batch), folder, label, and the waiting tool when known. External sessions have no waiting tool.
- **Transitions only.** An event needs a known previous state other than `needs_input`. The first sight of a session (a new hosted session, a scan that adds an external one) is not a transition. SessionStateTracker also notifies when the state does not change: that is not a transition either.
- **The route** sends the list on connect, then each change of the list and each new event. It keeps no history, so a desktop app that connects later gets no older event (REQ-5).
- **Texts** (gatekeeper decision, 2026-11-06). Title "<folder name> · <label>". The folder name follows `folderNameOf` of Avatar. Body "Permission for <tool>", as the needs-input card of SessionList, or "Needs your input" with no tool. The body is escaped, because some notification servers read it as markup.
- **Look.** The AppIcon PNG as the notification icon. Needs-input notifications have urgency `critical` and no timeout.
- **Focus.** "The window has the focus" means that the Electron window is focused. A hidden or minimized window is not focused. Notifications already on screen stay when the window gets the focus.
- **Opening.** The page reports its open session each time it changes. The desktop app closes the notification of session X when the window has the focus and X becomes the open session. It also closes it when the window gets the focus while X is already open (gatekeeper decision on REQ-12).
- **Click.** The same action as "Open Window" (restore, show, focus), then "open this session" to the page. The page opens it only when its list has it.
- **Mechanism** (gatekeeper decision, 2026-11-06). The adapter must be able to replace a notification in place later (REQ-19, next batch). Grouping updates one notification many times, so closing and showing again is not enough. Check this first:
  - Electron's `Notification` can replace in place on Linux → use it, and add no dependency.
  - It cannot → use the D-Bus interface `org.freedesktop.Notifications` (`Notify` with `replaces_id`, `CloseNotification`, the `ActionInvoked` signal). Use one small D-Bus client package from npm, pure JavaScript, with no native build. Do not run `gdbus` by hand: escaping user text and reading `gdbus monitor` output are fragile.
- **Preload.** Electron runs a sandboxed preload as a script, not as an ES module. It is emitted as CommonJS.
- **Reconnection.** After a drop, the attention client tries again every 2 seconds while the app runs. The list it gets on reconnect replaces the old one.
- **Tests.** Vitest for the monitor, the route, the rules and the texts, with fake sessions and a fake clock. Browser e2e for the page side, with a fake bridge injected in the page. Electron e2e only for what Vitest cannot check, and only in the Electron group (knowledge base `electron-e2e-separate`).

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | backend, sessions area | Attention monitor: follow SessionStateTracker and ExternalSessionScanner. When a known session goes from another state to `needs_input`, emit one event (decision "Event"). | REQ-1, REQ-2, REQ-5, REQ-6, REQ-7, REQ-8 | — |
| INT-2 | create | backend, sessions area | Attention monitor, same component as INT-1: keep the list of the hosted and external sessions in `needs_input`, and tell listeners when it changes. An ended or removed session leaves it. | REQ-11 | INT-1 |
| INT-3 | create | backend, sessions area | Attention route: a WebSocket under `/api`. On connect it sends the list. Then it sends each change of the list and each event, once. | REQ-1, REQ-5, REQ-6, REQ-11 | INT-1, INT-2 |
| INT-4 | modify | `src/server/main.ts` | At start, create the attention monitor with the tracker and the scanner, and register the attention route. | REQ-1 | INT-3 |
| INT-5 | create | desktop area | Attention client: when the backend is ready, connect to the attention route and pass on its events and lists. After a drop, try again every 2 seconds. | REQ-1, REQ-2, REQ-4 | — |
| INT-6 | create | desktop area | Notification rules: from the events and the window focus, decide which notification to show. Nothing shows while the window has the focus. An event id seen before is ignored. | REQ-3, REQ-4, REQ-6 | — |
| INT-7 | create | desktop area | Notification rules, same component as INT-6: close a needs-input notification when its session leaves the list. Close the notification of a session when that session is opened (decision "Opening"). | REQ-11, REQ-12 | INT-6 |
| INT-8 | create | desktop area | Notification texts: title and needs-input body (decision "Texts"). | REQ-7, REQ-8, REQ-9 | — |
| INT-9 | create | desktop area | System notifications: show a notification of the Linux desktop, urgent and with no timeout for needs input. Close it on request. Report a click, with its session. | REQ-10, REQ-13 | — |
| INT-10 | create | desktop area | Desktop bridge: a sandboxed preload. It gives the page a call to report its open session and a listener for "open this session", and nothing else. | REQ-12, REQ-13 | — |
| INT-11 | modify | `src/desktop/main.ts` | Load the bridge in the window. When the backend is ready, start the attention client. Pass its data, the window focus and the page's open session to the rules, and their decisions to the system notifications. | REQ-1, REQ-3, REQ-4, REQ-12 | INT-5, INT-6, INT-7, INT-8, INT-9, INT-10 |
| INT-12 | modify | `src/desktop/main.ts` | On a notification click, run the "Open Window" action, then send "open this session" to the page. | REQ-13 | INT-9, INT-11 |
| INT-13 | create | frontend, app area | Page side of the bridge: when the desktop bridge exists, give its "open this session" requests and report the open session. In a browser it does nothing. | REQ-12, REQ-13 | — |
| INT-14 | modify | `src/web/AppLayout.tsx` | "Open this session" opens the session as a list click does, only when LiveSessionStore lists it. Report each change of the open session. | REQ-12, REQ-13, REQ-20 | INT-13 |
| INT-15 | modify | `.sdd/.archi` | Enabling. Record the desktop preload and the notification mechanism. If a D-Bus client package is added, record it with its reason. | — | INT-9, INT-10 |

INT-14 also serves `REQ-20`, which closes in `turn-end-notification`. The developer updates the specs of Server, DesktopApp and AppLayout. They write the specs of the new components and update the indexes.

## Human acceptance

### Scenario: A waiting session alerts the user while the window is closed

- REQ → REQ-1, REQ-2, REQ-4, REQ-7, REQ-8, REQ-10
- Given → the desktop app runs with its window closed to the tray, and the user works in the browser client on a hosted session of folder "ai-client", labelled "Fix the login form"
- When → the user sends a prompt that makes Claude ask for permission to run Bash
- Then → within 5 seconds an urgent notification "ai-client · Fix the login form" says "Permission for Bash"
- And → it stays on screen until the user closes it

### Scenario: A click on the notification opens the session

- REQ → REQ-13
- Given → a needs-input notification of an external session is on screen, and the window is closed to the tray
- When → the user clicks the notification
- Then → the window comes to the front with that session open

### Scenario: The notification goes when the need is gone

- REQ → REQ-9, REQ-11
- Given → an external session asks for a permission, and its notification says "Needs your input"
- When → the user answers in the terminal of that session
- Then → the notification disappears

### Scenario: Bringing back the window on the open session clears its notification

- REQ → REQ-12
- Given → the window is behind another application with session A open, and a needs-input notification of session A is on screen
- When → the user brings the window to the front
- Then → the notification of session A disappears

### Scenario: No notification while the user looks at the window

- REQ → REQ-3
- Given → the window has the focus and shows a hosted session
- When → the user sends a prompt that makes Claude ask for permission to run Bash
- Then → no system notification appears

### Scenario: Old and repeated states do not notify

- REQ → REQ-5, REQ-6
- Given → an external session already needs input, and the desktop app is not running
- When → the user launches "Vexel for Claude"
- Then → no notification appears for that session
- And → none appears later while the session keeps waiting
