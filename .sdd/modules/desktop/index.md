# Module desktop

| Component | Type | Path | Responsibility | Spec |
|-----------|------|------|----------------|------|
| DesktopApp | Electron main process | `src/desktop/main.ts` | One-instance window that shows the startup page, starts the backend through the launcher, then loads the client page | `specs/desktop-app.md` |
| BackendLauncher | backend service | `src/desktop/backend-launcher.ts` | Reuses a backend that answers the health check, or starts the server detached and waits until it is ready or has failed | `specs/backend-launcher.md` |
| StartupPage | UI page | `src/desktop/startup-page.ts` | Data URL page "Starting the backend…" or "The backend could not start." with the output lines | `specs/startup-page.md` |
| AppIcon | asset | `src/desktop/icons/vexel-for-claude.svg`, `src/desktop/icons/vexel-for-claude.png` | "VX" logo mark icon for the menu entry and the window | `specs/app-icon.md` |
| MenuEntry | configuration and command | `src/desktop/menu-entry.ts`, `src/desktop/install-menu-entry.ts` | Desktop Entry "Vexel for Claude" and the install command that writes it into the application menu | `specs/menu-entry.md` |
