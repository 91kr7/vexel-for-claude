---
module: desktop
component: AppIcon
type: asset
---

# AppIcon

**Purpose** → the icon of the desktop app, from the "VX" logo mark of the TopBar (module app).

## Contract

- `vexel-for-claude.svg` → scalable icon, for the menu entry.
- `vexel-for-claude.png` → 256 × 256 px with transparency, for the window.
- both show a rounded square with a 135° gradient from `#8ccfff` to `#008ef4`, and the letters "VX" in `#0b0b0e`.

## Rules and invariants

- The letters are drawn as paths, so the icon does not depend on an installed font.
- The PNG is the SVG rendered at 256 px.

## Requirements served

- `plan-desktop_app/REQ-2`
