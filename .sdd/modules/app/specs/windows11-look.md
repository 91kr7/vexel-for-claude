---
module: app
component: Windows11Look
type: configuration
---

# Windows11Look

**Purpose** → the styles of the Windows 11 look: Mica-like surfaces, the Windows 11 default accent blue, Segoe UI, 4 px and 8 px corners, and the Windows-style WindowButtons. They apply on top of the light or dark set of ThemeTokens when the root carries `data-look="windows11"` (the mark of LookStore).

## Contract

- WebEntry loads it with the global styles, right after ThemeTokens.
- Both themes:
  - `--font-ui` → Segoe UI Variable Text, Segoe UI Variable, Segoe UI, Selawik, then `system-ui` and `sans-serif`.
  - `--caption-close` `#c42b1c`, `--caption-close-pressed` `#b3261a`, `--radius-control` 4 px, `--radius-overlay` 8 px.
  - `--accent-deep` → `#0078d4`, the Windows 11 default accent blue.
- Dark theme (any `data-theme` other than `light`):

| Token | Value |
|-------|-------|
| `--bg-canvas` | `#1c1c1c` |
| `--bg-surface-1` / `-2` / `-3` | `#202020` / `#2b2b2b` / `#323232` |
| `--bg-glass` | `rgba(44, 44, 44, 0.92)` |
| `--border-subtle` / `--border-strong` | white at 7 % / 14 % |
| `--specular-top` | white at 5 % |
| `--text-primary` / `-secondary` / `-muted` | `#ffffff` / `#c8c8c8` / `#9d9d9d` |
| `--accent-primary` | `#60cdff`; glow / border / selection at 14 % / 40 % / 30 % |
| `--on-accent` | `#000000` |
| `--rose-400` / `--zinc-400` | `#fb8092` / `#a6a6ae` |
| `--caption-hover` / `--caption-pressed` | white at 8 % / 5 % |

- Light theme (`data-theme="light"`):

| Token | Value |
|-------|-------|
| `--bg-canvas` | `#eeeeee` |
| `--bg-surface-1` / `-2` / `-3` | `#f3f3f3` / `#fafafa` / `#e9e9e9` |
| `--bg-glass` | `rgba(252, 252, 252, 0.92)` |
| `--border-subtle` / `--border-strong` | black at 7 % / 14 % |
| `--specular-top` | white at 70 % |
| `--text-primary` / `-secondary` / `-muted` | `#1a1a1a` / `#5d5d5d` / `#616161` |
| `--accent-primary` | `#005fb8`; glow / border / selection at 10 % / 35 % / 30 % |
| `--on-accent` | `#ffffff` |
| `--orange-400` | `#b32912` |
| `--caption-hover` / `--caption-pressed` | black at 5 % / 3 % |

- corners → `--radius-control` on buttons, chips, fields, list rows, tooltips and the logo mark. `--radius-overlay` on cards, popovers, panels, notices, snackbars and dialogs.
- `.button-primary` → flat accent fill with a darker 1 px bottom edge, a little brighter on hover.
- "Vexel" in the top bar → no negative letter spacing.
- `.caption-buttons`, `.caption-button`, `.caption-close`, `.caption-glyph` → the Windows-style WindowButtons, described in that spec.

## Rules and invariants

- With any other `data-look`, or none, nothing here applies: the current look stays exactly as it is.
- The look does not depend on the theme: each theme has its own token set, and a theme change keeps the look.
- `--font-mono` and the terminal tokens do not change: the terminal panel stays dark in both looks.
- No font file is bundled. Where Segoe UI is not installed (Linux by default), the next font of the list shows.
- The app reads no Windows accent colour and no wallpaper.
- Contrast (WCAG 2.2 AA), in each theme:
  - `--text-primary`, `-secondary` and `-muted` reach 4.5:1 on canvas and surfaces 1–3. `--text-muted` is the lowest: about 4.7:1 dark, 5.1:1 light, on surface 3.
  - `--accent-primary` reaches 4.5:1 on canvas and surfaces 1–3: about 7.1:1 dark, 5.2:1 light.
  - `--on-accent` reaches 4.5:1 on `--accent-primary` (about 11.7:1 dark, 6.3:1 light) and on `--accent-deep` (about 4.6:1 dark, 4.5:1 light).
  - the status text tones reach 4.5:1 on canvas, on surfaces 1–3 and on the 15 % tint of their family over them. `--orange-400` reaches it on surface 1 and on its 15 % and 25 % tints over it.
- Accent tone: `--accent-deep` keeps the Windows blue `#0078d4`. `--accent-primary` takes the Windows lighter (dark theme) and darker (light theme) shade of the same blue, because `#0078d4` gives less than 4.5:1 as text on the surfaces (about 3.7:1 on light surface 3).
- Status tones: only `--rose-400` and `--zinc-400` (dark) and `--orange-400` (light) change, by the smallest HSL lightness step that reaches the contrast. Hue and saturation stay, so working (green), needs input (amber), error (rose), Interrupt (orange) and the grey of waiting and ended keep the colours of the current look.

## Dependencies

- ThemeTokens, LookStore (the mark), WebEntry (loads it), WindowButtons (the caption classes)

## Requirements served

- `plan-wsl_support/REQ-17`, `plan-wsl_support/REQ-25`, `plan-wsl_support/REQ-26`, `plan-wsl_support/REQ-27`, `plan-wsl_support/REQ-34`, `plan-wsl_support/REQ-36`, `plan-wsl_support/REQ-37`, `plan-wsl_support/REQ-38`
