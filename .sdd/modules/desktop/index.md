# Module desktop

| Component | Type | Path | Responsibility | Spec |
|-----------|------|------|----------------|------|
| DesktopApp | Electron main process | `src/desktop/main.ts` | One-instance window and tray icon: shows the startup page, starts the backend through the launcher, loads the client page, wires the notifications and the tray signal; close hides the window, quit confirms and stops the backend it started | `specs/desktop-app.md` |
| BackendLauncher | backend service | `src/desktop/backend-launcher.ts` | Reuses a backend that answers the health check, or starts the server detached and waits until it is ready or has failed; stops the server it started | `specs/backend-launcher.md` |
| StartupPage | UI page | `src/desktop/startup-page.ts` | Light data URL page "Starting the backend…" or "The backend could not start." with the output lines | `specs/startup-page.md` |
| AppIcon | asset | `src/desktop/icons/vexel-for-claude.svg`, `src/desktop/icons/vexel-for-claude.png` | "VX" logo mark icon for the menu entry and the window | `specs/app-icon.md` |
| AttentionIcon | asset | `src/desktop/icons/vexel-for-claude-attention.svg`, `src/desktop/icons/vexel-for-claude-attention.png` | The AppIcon with an amber badge, for the tray while a session needs input | `specs/attention-icon.md` |
| MenuEntry | configuration and command | `src/desktop/menu-entry.ts`, `src/desktop/install-menu-entry.ts` | Desktop Entry "Vexel for Claude" and the install command that writes it into the application menu | `specs/menu-entry.md` |
| TrayIcon | UI component | `src/desktop/tray-icon.ts` | Tray icon, tooltip and menu: normal or attention look by the sessions that need input, one entry per waiting session, then "Open Window" and "Quit" | `specs/tray-icon.md` |
| QuitCheck | backend service | `src/desktop/quit-check.ts` | Counts the busy hosted sessions of a backend the app started and asks "Quit Vexel for Claude?" when there are any | `specs/quit-check.md` |
| AttentionClient | backend service | `src/desktop/attention-client.ts` | WebSocket to `/api/attention` that passes on events and needs-input lists, and connects again every 2 s after a drop | `specs/attention-client.md` |
| NotificationRules | backend service | `src/desktop/notification-rules.ts` | Decides which notification to show, group in 5-second bursts or close, from events, the needs-input list, the window focus and the open session | `specs/notification-rules.md` |
| NotificationTexts | backend service | `src/desktop/notification-texts.ts` | English title "<folder> · <label>" and body of each notification, and the grouped title and body | `specs/notification-texts.md` |
| SystemNotifications | backend service | `src/desktop/system-notifications.ts` | Shows, replaces and closes one notification per session over D-Bus `org.freedesktop.Notifications`, and reports clicks and closes | `specs/system-notifications.md` |
| DesktopBridge | Electron preload | `src/desktop/desktop-bridge.cts` | `window.desktopBridge`: the page reports its open session and receives "open this session" | `specs/desktop-bridge.md` |
