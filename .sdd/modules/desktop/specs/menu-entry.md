---
module: desktop
component: MenuEntry
type: configuration and command
---

# MenuEntry

**Purpose** → the "Vexel for Claude" entry of the Linux application menu, and the command that installs it.

## Contract

- `menuEntryContent({ repoRoot, electronPath, nodePath }) → string` → a Desktop Entry file:
  - `Type=Application`, `Name=Vexel for Claude`, `Comment=Manage Claude Code sessions`, `Terminal=false`, `Categories=Development;`
  - `Exec` → runs `electronPath` on `repoRoot`, with `AI_CLIENT_NODE=<nodePath>` in its environment.
  - `Icon` → the absolute path of the AppIcon SVG in `repoRoot`.
  - `StartupWMClass=ai-client` → the window class Electron takes from the package name, so the desktop groups the window under the entry.
  - arguments with spaces or special characters are quoted as the Desktop Entry specification requires.
- `applicationsDir(env) → string`
  - `env.AI_CLIENT_APPLICATIONS_DIR` when set.
  - else `<XDG_DATA_HOME>/applications`, with `XDG_DATA_HOME` defaulting to `~/.local/share`.
- `installMenuEntry({ targetDir, repoRoot, electronPath, nodePath }) → Promise<string>` → creates `targetDir` if needed, writes `vexel-for-claude.desktop` there (replacing an older one) and returns its path.
- command `npm run desktop:install` → builds the page and the desktop app, then installs the entry in `applicationsDir(process.env)`. It uses the Node that runs it as `nodePath`, and the Electron of the repository. It prints the path of the written file.

## Rules and invariants

- `Exec` uses absolute paths only. The desktop session does not need `node` on its `PATH`.
- The entry depends on the repository folder: moving the repository needs a new install.

## Dependencies

- AppIcon, DesktopApp

## Requirements served

- `plan-desktop_app/REQ-2`
