---
batch: tray-signal
feature: Tray signal
closed_req: REQ-30, REQ-31, REQ-32, REQ-33, REQ-34, REQ-35, REQ-36, REQ-37
depends: needs-input-notification
---

# Batch — Tray signal

While a session needs input, the tray icon has an attention look, its tooltip gives the count, and its menu has one entry for each waiting session. An entry opens that session.

## What this batch builds

- **Attention icon** (desktop area, next to the AppIcon) → the app icon with an amber badge, shown in the tray while a session needs input.

## Decisions

- **Modify targets from `needs-input-notification`.** The attention monitor and the attention client are named by component. Their paths are in the indexes.
- **The source is the list of the attention route.** It holds the hosted and external sessions in `needs_input`. It comes on connect and after each change, whatever the window focus. So the tray also shows the sessions that already wait when the desktop app starts.
- **Waiting since.** The monitor keeps the time when it saw a session enter `needs_input`. A session that already waited when the monitor started gets its last activity.
- **Icon.** The AppIcon with an amber-500 badge in the top right corner. The badge has a dark ring inside a light ring, so it reads on light and dark panels at 16 to 24 px. SVG and PNG, like the AppIcon. Amber is the needs-input colour of the page.
- **Tooltip** (gatekeeper decision, 2026-11-06). "Vexel for Claude · 1 session needs input", or "Vexel for Claude · N sessions need input". With no waiting session: "Vexel for Claude", as today.
- **Menu** (gatekeeper decision, 2026-11-06). One entry per waiting session, "<folder name> · <label>" by the title rule of the notification texts, longest waiting first. Then a separator, then "Open Window" and "Quit" as today.
- **Entry click.** The same action as a notification click: "Open Window", then "open this session" to the page.
- **Linux.** Electron needs `setContextMenu` again after a menu change. Some tray hosts do not show tooltips: then REQ-32 depends on the desktop. The batch does not work around it.
- **Tests.** Vitest for the menu template, the tooltip, the icon choice and the monitor list. No Electron e2e is needed. If one is added, it goes in the Electron group (knowledge base `electron-e2e-separate`).

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | desktop area, next to the AppIcon | Attention icon (decision "Icon"). | REQ-30, REQ-31 | — |
| INT-2 | modify | Attention monitor (from `needs-input-notification`) | Each entry of the list also carries the folder, the label and the waiting-since time. A change of the label is a change of the list. | REQ-33, REQ-35 | — |
| INT-3 | modify | `src/desktop/tray-icon.ts` | Menu template: the waiting sessions, longest waiting first, then a separator, then "Open Window" and "Quit" unchanged (decision "Menu"). | REQ-33, REQ-35, REQ-37 | — |
| INT-4 | modify | `src/desktop/tray-icon.ts` | With waiting sessions: the attention icon and the count tooltip. Without: the AppIcon and "Vexel for Claude" (decision "Tooltip"). | REQ-30, REQ-32 | INT-1 |
| INT-5 | modify | `src/desktop/main.ts` | On each list from the attention client, update the tray icon, tooltip and menu, whatever the focus. A menu entry runs the action of a notification click. | REQ-30, REQ-32, REQ-33, REQ-34, REQ-36 | INT-3, INT-4 |

The developer updates the specs of TrayIcon, DesktopApp and the attention monitor. They write the spec of the attention icon and update the indexes.

## Human acceptance

### Scenario: The tray lists the sessions that wait

- REQ → REQ-30, REQ-31, REQ-32, REQ-33, REQ-35, REQ-37
- Given → session A asks for a permission, then session B asks for one too
- When → the user opens the tray menu
- Then → the tray icon shows the amber badge, and the tooltip says "Vexel for Claude · 2 sessions need input"
- And → the menu lists A, then B, then "Open Window" and "Quit"

### Scenario: A tray entry opens its session

- REQ → REQ-34
- Given → the window is closed to the tray, and session A needs input
- When → the user chooses the entry of session A in the tray menu
- Then → the window comes to the front with session A open

### Scenario: The tray returns to normal while the user works in the window

- REQ → REQ-30, REQ-36
- Given → the window has the focus, and its open hosted session is the only one that needs input
- When → the user answers the permission in the window
- Then → the tray icon returns to its normal look, and the menu has no session entry
