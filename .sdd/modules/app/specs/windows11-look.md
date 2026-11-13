---
module: app
component: Windows11Look
type: configuration
---

# Windows11Look

**Purpose** → the styles of the Windows 11 look (Fluent): neutral Mica-like surfaces, the Windows accent blue, Segoe UI, 4 px controls and 8 px overlays, and the caption buttons of the WindowButtons. They apply on top of the light or dark set of ThemeTokens when the root carries `data-look="windows11"` (the mark of LookStore).

## Contract

- imported by the global styles of WebEntry, right after ThemeTokens.
- `:root[data-look='windows11']` → overrides the dark set: `--font-ui` (Segoe UI Variable Text, Segoe UI Variable, Segoe UI, Selawik, then the system font), surfaces `#1c1c1c` / `#202020` / `#2b2b2b` / `#323232`, white text, `--text-muted` `#9d9d9d`, accent `#60cdff` with `#0078d4` as deep accent and black on the accent. It adds `--caption-hover`, `--caption-pressed`, `--caption-close` `#c42b1c`, `--caption-close-pressed`, `--radius-control` 4 px and `--radius-overlay` 8 px.
- `:root[data-look='windows11'][data-theme='light']` → sets again every token above for the light theme: surfaces `#eeeeee` / `#f3f3f3` / `#fafafa` / `#e9e9e9`, text `#1a1a1a`, `--text-muted` `#616161`, accent `#005fb8`, white on the accent.
- corners → `--radius-control` on buttons, chips, fields, rows, tooltips and the logo mark; `--radius-overlay` on cards, popovers, panels, snackbars and dialogs.
- `.button-primary` → flat accent fill with a darker 1 px bottom edge, a little brighter on hover.
- `.caption-buttons`, `.caption-button`, `.caption-close`, `.caption-glyph` → the Windows 11 look of the WindowButtons.

## Rules and invariants

- With any other `data-look`, or none, nothing here applies: the client keeps the Vexel look.
- The light rule sets every token the dark rule sets, so it wins over it in the light theme.
- `--font-mono` and the terminal tokens do not change: xterm reads them only when a terminal opens, so a live change would not reach open terminals.
- `--text-muted` reaches 4.5:1 on surface 3 in both themes (about 4.7:1 dark, 5:1 light).
- Segoe UI is not on Linux by default: there the system font shows.

## Dependencies

- ThemeTokens, LookStore (the mark), WebEntry (imports it)

## Requirements served

- None: added outside the spec-driven workflow (branch `feature/wsl-support`), with no analysis or plan.
