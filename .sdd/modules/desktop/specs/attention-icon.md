---
module: desktop
component: AttentionIcon
type: asset
---

# AttentionIcon

**Purpose** → the tray icon while a session needs input: the AppIcon with an amber badge.

## Contract

- `vexel-for-claude-attention.svg` → scalable icon.
- `vexel-for-claude-attention.png` → 256 × 256 px with transparency, for the tray.
- both show the AppIcon with a round badge in the top right corner. The badge has an amber-500 `#f59e0b` core, a dark `#0b0b0e` ring around it, and a light `#ffffff` ring outside.

## Rules and invariants

- The PNG is the SVG rendered at 256 px.
- The two rings keep the badge visible on light and dark panels, at 16 to 24 px.
- Amber is the needs-input colour of the page.

## Dependencies

- AppIcon

## Requirements served

- `plan-session_notifications/REQ-30`, `plan-session_notifications/REQ-31`
