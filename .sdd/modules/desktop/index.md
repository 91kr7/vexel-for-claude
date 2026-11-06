# Module desktop

| Component | Type | Path | Responsibility | Spec |
|-----------|------|------|----------------|------|
| DesktopApp | Electron main process | `src/desktop/main.ts` | One-instance window and tray icon: shows the startup page, starts the backend through the launcher, loads the client page; close hides the window, quit confirms and stops the backend it started | `specs/desktop-app.md` |
| BackendLauncher | backend service | `src/desktop/backend-launcher.ts` | Reuses a backend that answers the health check, or starts the server detached and waits until it is ready or has failed; stops the server it started | `specs/backend-launcher.md` |
| StartupPage | UI page | `src/desktop/startup-page.ts` | Light data URL page "Starting the backend…" or "The backend could not start." with the output lines | `specs/startup-page.md` |
| AppIcon | asset | `src/desktop/icons/vexel-for-claude.svg`, `src/desktop/icons/vexel-for-claude.png` | "VX" logo mark icon for the menu entry and the window | `specs/app-icon.md` |
| MenuEntry | configuration and command | `src/desktop/menu-entry.ts`, `src/desktop/install-menu-entry.ts` | Desktop Entry "Vexel for Claude" and the install command that writes it into the application menu | `specs/menu-entry.md` |
| TrayIcon | UI component | `src/desktop/tray-icon.ts` | Tray tooltip and menu "Open Window" and "Quit", wired to the actions of the desktop app | `specs/tray-icon.md` |
| QuitCheck | backend service | `src/desktop/quit-check.ts` | Counts the busy hosted sessions of a backend the app started and asks "Quit Vexel for Claude?" when there are any | `specs/quit-check.md` |
