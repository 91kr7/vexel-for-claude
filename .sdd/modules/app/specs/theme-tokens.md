---
module: app
component: ThemeTokens
type: configuration
---

# ThemeTokens

**Purpose** → the shared CSS custom properties of the client: a dark set from the `:root` block of `.sdd/mockups/studio-dark/mock.html` with a light-blue accent, a light set from the preset "Cool Slate · Full Light" of `.sdd/mockups/cool_slate_light/mock.html`, and a Dark Blue set from `.sdd/mockups/dark_blue_theme/mock.html`.

## Contract

- The tokens are custom properties on `:root`. Every style of the client takes its colours from them.
- Three sets. The dark set is on `:root`. The light set overrides it when the root carries `data-theme="light"`, the Dark Blue set when it carries `data-theme="dark-blue"` (marks of ThemeStore). Any other mark, or none, gives the dark set.
- There is no `prefers-color-scheme` rule. The system theme changes nothing.

### Dark set

- Mock tokens, with the mock's `:root` values:

| Token | Value |
|-------|-------|
| `--bg-canvas` | `#0b0b0e` |
| `--bg-surface-1` / `-2` / `-3` | `#121216` / `#18181f` / `#21212b` |
| `--bg-glass` | `rgba(24, 24, 31, 0.82)` |
| `--border-subtle` / `--border-strong` | white at 7 % / 13 % |
| `--specular-top` | white at 8 % |
| `--text-primary` / `--text-secondary` | `#f3f2ee` / `#a1a0ab` |
| `--text-muted` | `#898894` (the mock's `#686773`, lightened, see rules) |
| `--term-size` | `12px` |

- Accent family (light blue in place of the mock's orange):

| Token | Value |
|-------|-------|
| `--accent-primary` | `#8ccfff`, the dark `--primary` of the previous theme |
| `--accent-secondary` | `#d6eeff`: same HSL hue (205°), CIELAB L* higher by the gap from `#e06d44` to `#f29a76` (about 12.6) |
| `--accent-deep` | `#008ef4`: same HSL hue and saturation, L* lower by the gap from `#e06d44` to `#9a3412` (about 22.5) |
| `--accent-glow` / `--accent-border` | `--accent-primary` at 16 % / 42 % |
| `--accent-selection` | `--accent-primary` at 30 % |
| `--on-accent` | `--bg-canvas`: text on an accent fill |

- Status colours, Tailwind v3 values: `--emerald-400/500`, `--amber-300/400/500`, `--rose-300/400/500`, `--zinc-400/500`. Tints of the 500 tone: `--emerald-500-15/30`, `--amber-500-15/20/25/30/40`, `--rose-500-15/25/30`, `--zinc-500-15/30` (the suffix is the opacity in %).
- Orange of "Interrupt", Tailwind v3 values: `--orange-400` `#fb923c` (text and icon), `--orange-500` `#f97316`, and its tints `--orange-500-15/25/30`.
- Names kept because components read them:
  - `--color-error` → `--rose-400`
  - `--color-focus-ring` → `--accent-primary`
  - `--color-backdrop` → black at 65 % (dark set and Dark Blue)
- Terminal tokens: `--term-bg` `#0b0b0e`, `--term-fg` `#f3f2ee`, `--term-cursor` `#8ccfff`, `--term-selection` `rgba(140, 207, 255, 0.3)`, `--term-frame` (frame border) → `--role-border-strong`.
- No ANSI token (`--term-ansi-*`) is set: the terminal keeps the xterm.js ANSI defaults.
- Tool output block of external sessions: `--tool-output-bg` → `--role-canvas`, `--tool-output-text` → `--text-secondary`, `--tool-output-line` (its top line) → `--role-border-subtle`.
- Theme preview tokens, the same in every set, so each preview card of ThemeSection shows its own theme: `--preview-dark-canvas` `#0b0b0e`, `--preview-dark-surface` `#21212b`, `--preview-dark-line` `#f3f2ee`, `--preview-dark-accent` `#8ccfff`; `--preview-light-canvas` `#f3f5f8`, `--preview-light-surface` `#ffffff`, `--preview-light-line` `#0f172a`, `--preview-light-accent` `#2563eb`; `--preview-dark-blue-canvas` `#12151e`, `--preview-dark-blue-surface` `#212736`, `--preview-dark-blue-line` `#f1f5f9`, `--preview-dark-blue-accent` `#38bdf8`.
- Window button tokens, the same in both sets: `--window-close` `#e0443c`, `--window-minimize` `#e8b616`, `--window-maximize` `#25b033`, `--window-symbol` black at 60 %.
- Terminal search tokens, in `#RRGGBB` form: `--term-match-bg` `#713f12` (a match), `--term-match-current-bg` `#92400e` and `--term-match-current-border` `#fcd34d` (the current match).
- Other groups, the same in both sets: `--font-ui` (Roboto Flex), `--font-mono` (Roboto Mono), `--focus-ring-width` and `--focus-ring-offset` (2 px), and the Tailwind shadows `--shadow-sm`, `--shadow`, `--shadow-lg`, `--shadow-2xl`.

### Role tokens

- One token per surface role of `.sdd/mockups/dark_blue_theme/mock.html`. Each one points to a level of the active set, so it takes the light or dark value:

| Role token | Mock use | Level |
|------------|----------|-------|
| `--role-canvas` | canvas and rail | `--bg-canvas` |
| `--role-list` | session list | `--bg-surface-1` |
| `--role-chrome` | title bar, session header, bottom bar | `--bg-surface-1` |
| `--role-card` | card | `--bg-surface-2` |
| `--role-raised` | raised surface and pill | `--bg-surface-2` |
| `--role-card-active` | active card | `--bg-surface-3` |
| `--role-border-subtle` / `--role-border-strong` | subtle / strong border | `--border-subtle` / `--border-strong` |
| `--role-accent` / `--role-accent-glow` / `--role-accent-border` | accent | `--accent-primary` / `--accent-glow` / `--accent-border` |
| `--role-rail` | navigation rail | `--role-canvas` |
| `--role-hover` | surface of a hovered card, row or button | `--bg-surface-3` |
| `--role-pill` | pills and chips | `--role-raised` |
| `--role-track` | progress and switch tracks | `--bg-surface-3` |
| `--role-context-bg` / `--role-context-text` / `--role-context-border` | context pill of the session footer | `--role-pill` / `--text-secondary` / `--role-border-strong` |

- Status dot tokens: `--emerald-dot` → `--emerald-400`, `--zinc-dot` → `--zinc-400`. The dot of a working session takes `--emerald-dot`, the dot of an idle or ended one `--zinc-dot`.

- Popup glass tokens, derived from the role tokens, so every theme and the Windows 11 look follow with no value of their own:
  - `--popup-glass-bg` → `--role-raised` at 60 % opacity
  - `--popup-glass-blur` → 8 px
- Native part tokens of WebEntry: `--scrollbar-thumb` → `--border-strong`, `--scrollbar-thumb-hover` → `--scrollbar-thumb`; `--field-bg` → `--role-canvas`, `--field-border` → `--role-border-strong`, `--field-focus-ring` → `--role-accent`.

### Shape tokens

- The mock's shapes, the same in both sets:

| Token | Value | Use |
|-------|-------|-----|
| `--radius-pill` | 5 px | pills, chips, key badges, small buttons |
| `--radius-card` | 7 px | cards and list rows |
| `--radius-frame` | 8 px | frames, dialogs, floating panels, buttons, fields |
| `--border-pill` | 1 px `--role-border-strong` | pill border |
| `--shadow-card` | `0 2px 10px` black at 28 % | raised or chosen card |
| `--shadow-frame` | `0 8px 24px -4px` black at 45 % | frames and floating panels |
| `--shadow-card-active` | `--shadow-card` | the open session card and the active list entry |

### Light set

- Table A of `plan-cool_slate_light` (the mock's preset "Cool Slate · Full Light"). Levels:

| Token | Value | Table A role |
|-------|-------|--------------|
| `--bg-canvas` | `#f3f5f8` | canvas, workspace |
| `--bg-surface-1` | `#f6f8fb` | title bar, session list, status bar |
| `--bg-surface-2` | `#ffffff` | card, raised surface, popover, dialog |
| `--bg-surface-3` | `#e9eef5` | pill, progress track |
| `--bg-glass` | white at 86 % | |
| `--border-subtle` / `--border-strong` | `#0f172a` at 8 % / 14 % | subtle / default border |
| `--specular-top` | white at 75 % | |
| `--text-primary` / `--text-secondary` | `#0f172a` / `#475569` | main / secondary text |
| `--text-muted` | `#5c6a7f` (the mock's `#64748b`, darkened, see rules) | muted text |

- Role tokens with a Light value of their own:

| Token | Value | Table A role |
|-------|-------|--------------|
| `--role-rail` | `#eef1f6` | navigation rail |
| `--role-hover` | `#f1f5f9` | surface on hover |
| `--role-card-active` | `#eef4ff` | active card surface |
| `--role-pill` / `--role-track` | `#e9eef5` | pill, progress track |
| `--role-context-bg` / `-text` / `-border` | `#dbeafe` / `#1d4ed8` / `#2563eb` at 22 % | accent pill (context) |

- Accent family:

| Token | Value |
|-------|-------|
| `--accent-primary` | `#2563eb`: active border, accent, progress fill, focus |
| `--accent-secondary` / `--accent-deep` | `#1d4ed8` / `#1e40af` |
| `--accent-glow` | `--accent-primary` at 12 % (the accent soft tint) |
| `--accent-border` | `--accent-primary` at 22 % (the accent pill border) |
| `--accent-selection` | `--accent-primary` at 30 % |
| `--on-accent` | `#ffffff` |

- `--color-focus-ring` and `--field-focus-ring` follow `--accent-primary`. `--field-bg` stays the canvas and `--field-border` the default border.
- Status colours. The text tones are those of table A, darkened only as much as the rules need:

| State | Text tone | Fill (`-15`, `-20`) | Hover fill (`-25`) | Border (`-30`, `-40`) | Dot |
|-------|-----------|---------------------|--------------------|-----------------------|-----|
| working (`--emerald-*`) | `--emerald-400` `#137638` | `#dcfce7` | — | `#86efac` | `--emerald-dot` `#16a34a`, `--emerald-500` `#16a34a` |
| warning: needs input (`--amber-*`) | `--amber-300`, `--amber-400` `#a84d08` | `#fef3c7` | `#fde68a` | `#fcd34d` | `--amber-400` |
| danger: error, Terminate (`--rose-*`) | `--rose-300`, `--rose-400` `#b81c1c` | `#fee2e2` | `#fecaca` | `#fca5a5` | — |
| Interrupt (`--orange-*`) | `--orange-400` `#a84d08` | `#fef3c7` | `#fde68a` | `#fcd34d` | — |
| idle, waiting, ended (`--zinc-*`) | `--zinc-400` `#5c6a7f` | `#e9eef5` | — | `#0f172a` at 14 % | `--zinc-dot` `#64748b`, `--zinc-500` `#64748b` |

- `--orange-500` → `#f59e0b`, the amber 500 tone.
- Scrollbars: `--scrollbar-thumb` `rgba(100, 116, 139, 0.28)`, `--scrollbar-thumb-hover` `rgba(100, 116, 139, 0.45)`.
- Shadows: `--shadow-card` `0 1px 2px rgba(15, 23, 42, 0.05)`, `--shadow-card-active` `0 2px 8px rgba(37, 99, 235, 0.1)`.
- Repository colours: `--repo-color-1` to `-6` → `#0369a1`, `#047857`, `#9a6700`, `#e11d48`, `#4d7c0f`, `#1d4ed8`.
- Terminal, table B of `plan-cool_slate_light`: `--term-bg` `#ffffff`, `--term-fg` `#1e293b`, `--term-cursor` `#2563eb`, `--term-selection` `#2563eb` at 20 %. `--term-frame` follows `--role-border-strong`, `#0f172a` at 14 %.
- Terminal search, warning tones of table A: `--term-match-bg` `#fef3c7`, `--term-match-current-bg` `#fcd34d`, `--term-match-current-border` `#b45309`.
- ANSI tokens, set only in Light:

| Colour | Token | Value | Bright token | Value |
|--------|-------|-------|--------------|-------|
| black | `--term-ansi-black` | `#0f172a` (strong text) | `--term-ansi-bright-black` | `#64748b` (muted text) |
| red | `--term-ansi-red` | `#b91c1c` | `--term-ansi-bright-red` | `#dc2626` |
| green | `--term-ansi-green` | `#15803d` | `--term-ansi-bright-green` | `#047857` |
| yellow | `--term-ansi-yellow` | `#b45309` | `--term-ansi-bright-yellow` | `#a16207` |
| blue | `--term-ansi-blue` | `#1d4ed8` (blue, links) | `--term-ansi-bright-blue` | `#2563eb` |
| magenta | `--term-ansi-magenta` | `#a21caf` | `--term-ansi-bright-magenta` | `#c026d3` |
| cyan | `--term-ansi-cyan` | `#0e7490` | `--term-ansi-bright-cyan` | `#0f766e` |
| white | `--term-ansi-white` | `#475569` (mid-grey) | `--term-ansi-bright-white` | `#5c6a7f` (mid-grey) |

- Tool output block: `--tool-output-bg` `#ffffff`, `--tool-output-text` `#1e293b`, `--tool-output-line` `#0f172a` at 10 % (the divider of table B).
- `--color-backdrop` → `#0f172a` at 20 %: the lightest slate dim that still sets a dialog apart from the page. Over it the 60 % popup glass composites to a light surface (about `#e8e9ec` on the canvas), not grey (Gatekeeper decision, 2026-11-20, on the human's request).
- `--shadow-frame`, the Tailwind shadows, the fonts and `--term-size` keep the dark values.

### Dark Blue set

- The mock's colours (REQ-36 table). Level tokens, so the role tokens follow them, plus two roles with their own value:

| Token | Value | Mock use |
|-------|-------|----------|
| `--bg-canvas` (`--role-canvas`) | `#12151e` | canvas and rail |
| `--bg-surface-1` (`--role-chrome`) | `#181c27` | title bar, session header, bottom bar |
| `--role-list` | `#161a24` | session list |
| `--bg-surface-2` (`--role-card`) | `#1b202c` | card |
| `--role-raised` | `#1d2230` | raised surface and pill |
| `--bg-surface-3` (`--role-card-active`) | `#212736` | active card |
| `--border-subtle` / `--border-strong` | `#2e3546` / `#384156` | subtle / strong border |
| `--bg-glass` | `#1d2230` at 86 % | |
| `--specular-top` | white at 5 % | |

- Text: `--text-primary` `#f1f5f9` (slate-100), `--text-secondary` `#94a3b8` (slate-400), `--text-muted` `#808fa4` (the mock's slate-500 `#64748b`, lightened, see rules).
- Accent family on the mock's `#38bdf8`:

| Token | Value |
|-------|-------|
| `--accent-primary` | `#38bdf8` |
| `--accent-secondary` | `#7dd3fc` (sky-300, the mock's light accent text) |
| `--accent-deep` | `#0284c7` (sky-600) |
| `--accent-glow` / `--accent-border` / `--accent-selection` | `--accent-primary` at 16 % / 42 % / 30 % |
| `--on-accent` | `#090d16`, the mock's text on the accent badge |

- Status: emerald, amber and rose keep the dark set values (the mock's Tailwind tones). Ended and waiting take the mock's slate: `--zinc-400` `#94a3b8`, `--zinc-500` `#64748b`, `--zinc-500-15/30` at 15 % / 30 %.
- Terminal: `--term-bg` `#11141c`, `--term-frame` `#333b4f`. The focus border and ring of the frame are the role accent at 75 % and 22 %, the mock's values. `--term-fg`, `--term-cursor`, `--term-selection`, the search tokens and the tool output tokens keep the dark values. No ANSI token is set.
- Native parts: `--scrollbar-thumb` `#2e3546`, `--scrollbar-thumb-hover` `#434e66`, `--field-bg` → `--role-raised`, `--field-border` `#3b445c`, `--field-focus-ring` accent at 25 % (the mock's prompt box).
- Any other token keeps the dark set value.

### Removed

- The Material 3 roles (`--primary`, `--sc-*`, …), the other `--color-*` names and the type, spacing and radius scales no longer exist.

## Rules and invariants

- No accent token is orange, indigo, violet or pink, as the old mock's accents were. The amber and brown tokens of warnings, needs input and terminal search highlights are allowed. The orange tokens are an action colour, not an accent.
- In each set, `--text-primary`, `--text-secondary` and `--text-muted` reach 4.5:1 on canvas and on surfaces 1, 2 and 3. In Light also on `--role-rail`, `--role-hover`, `--role-card-active`, `--role-pill` and `--role-context-bg`.
- Dark `--text-muted` is the least lightening of the mock value that reaches it on surface 3 (about 4.56:1). Light `--text-muted` is the least darkening of the mock value, same HSL hue and saturation, that reaches it on every Light surface (about 4.50:1 on `--role-context-bg`).
- Dark: `--on-accent` on `--accent-primary` reaches 4.5:1 (about 11.7:1), and on `--accent-deep` too (about 5.8:1).
- Light: `--accent-primary` keeps the mock value. As text it reaches 4.5:1 on canvas, surfaces 1 and 2, `--role-rail`, `--role-hover` and `--role-card-active` (lowest: rail, about 4.57:1). On surface 3 (pills and tracks), where it paints only icons, fills and focus, it reaches 3:1 (about 4.43:1). `--on-accent` reaches 5.2:1 on it and 8.7:1 on `--accent-deep`.
- Light: `--role-context-text` reaches 4.5:1 on `--role-context-bg` (about 5.5:1).
- Light: the status text tones stay apart from each other: green, amber-brown, red and slate grey.
- Light: each status text tone is the least HSL-lightness darkening of its table A value that reaches 4.5:1 on canvas, surfaces 1–3, the Light role surfaces and its own fill and hover fill. `--emerald-400` also on its 10 % tint over canvas and surfaces 1–2 (diff lines; about 4.56:1). `--amber-400` and `--rose-400` also on `--role-context-bg` (usage levels in the context pill). `--rose-400` changes by one step, `--amber-400` reaches about 4.52:1 on its hover fill.
- Light: `--zinc-400` equals `--text-muted`, so idle and ended text passes the same contrast; the dot keeps the mock's `#64748b`.
- `--orange-400` reaches 4.5:1 on surface 1 and on the `--orange-500-15` and `--orange-500-25` tints over it. Dark: about 8.3, 6.7 and 5.6:1. Light: about 5.3, 5.1 and 4.52:1.
- Dark and Dark Blue: `--orange-400` keeps its OKLCH hue apart from `--amber-400` and `--rose-400` of the same set (Dark: 56 against 84 and 13).
- Light: every `--orange-*` token equals the `--amber-*` token of the same use: "Interrupt" takes the warning colours.
- Dark and Dark Blue: no ANSI token is set, so the ANSI palette is the xterm.js default. Only Dark Blue has its own `--term-bg` and `--term-frame`.
- Light: every ANSI token reaches 4.5:1 on `--term-bg` (lowest: bright magenta, about 4.7:1). `--term-fg` reaches 4.5:1 on `--term-selection` over `--term-bg` (about 11:1).
- Light: `--term-fg` reaches 4.5:1 on `--term-match-bg` (about 13:1) and on `--term-match-current-bg` (about 10:1). `--term-match-current-border` reaches 3:1 on `--term-bg` (about 5.0:1).
- Light: `--tool-output-text` reaches 4.5:1 on `--tool-output-bg` (about 14.6:1).
- `--window-symbol` over each window button colour reaches 3:1 (about 3.16:1 on the red, the lowest). 52 % would give 2.72:1.
- Dark and Dark Blue: `--term-fg` reaches 4.5:1 on `--term-match-bg` (about 7.7:1) and on `--term-match-current-bg` (about 6.3:1). `--term-match-current-border` reaches 3:1 on `--term-bg` (about 13.6:1).
- `--font-ui` and `--font-mono` load the BundledFont files.
- In Dark a role token never has a value of its own: it always equals its level. In Dark Blue only `--role-list` and `--role-raised` have their own value. In Light only `--role-rail`, `--role-hover`, `--role-card-active`, `--role-pill`, `--role-track` and the three context pill tokens have their own value.
- Dark and Dark Blue: `--role-rail`, `--role-hover`, `--role-pill`, `--role-track`, the context pill tokens, `--emerald-dot`, `--zinc-dot` and `--shadow-card-active` equal the level or token they replace, so these themes look as before.
- Dark Blue: `--text-primary`, `-secondary` and `-muted` reach 4.5:1 on canvas, surfaces 1–3, `--role-list` and `--role-raised` (lowest: muted on surface 3, about 4.53:1). `--text-muted` is the least HSL-lightness lightening of the mock value that reaches it.
- Dark Blue: the status text tones (`--emerald-400`, `--amber-300/400`, `--rose-300/400`, `--zinc-400`, `--orange-400`) reach 4.5:1 on canvas, on surfaces 1–3 and on the 15 % tint of their family over them (lowest: `--rose-400`, about 4.8:1).
- Dark Blue: `--on-accent` reaches 4.5:1 on `--accent-primary` (about 9.1:1) and on `--accent-deep` (about 4.7:1). `--accent-primary`, the focus ring, reaches 3:1 on every surface (about 7.0:1 on surface 3).

## Dependencies

- BundledFont

## Requirements served

- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-3`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-4`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-5`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-6`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-8`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-51`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-52`
- `plan-claude_sessions_client-ui_redesign/REQ-1`, `plan-claude_sessions_client-ui_redesign/REQ-3`
- `plan-mac_title_bar/REQ-22`, `plan-mac_title_bar/REQ-26`
- `plan-light_theme/REQ-6`, `plan-light_theme/REQ-7`, `plan-light_theme/REQ-8`, `plan-light_theme/REQ-9`, `plan-light_theme/REQ-10`, `plan-light_theme/REQ-12`, `plan-light_theme/REQ-13`, `plan-light_theme/REQ-14`, `plan-light_theme/REQ-15`, `plan-light_theme/REQ-16`
- `plan-terminal_addons/REQ-22`, `plan-terminal_addons/REQ-31`
- `plan-session_list_width/REQ-34`, `plan-session_list_width/REQ-35`
- `plan-ui_restyle/REQ-5`
- `plan-dark_blue_theme/REQ-1`, `plan-dark_blue_theme/REQ-2`, `plan-dark_blue_theme/REQ-3`, `plan-dark_blue_theme/REQ-5`
- `plan-dark_blue_theme/REQ-30`, `plan-dark_blue_theme/REQ-36`, `plan-dark_blue_theme/REQ-37`, `plan-dark_blue_theme/REQ-38`, `plan-dark_blue_theme/REQ-39`, `plan-dark_blue_theme/REQ-40`, `plan-dark_blue_theme/REQ-41`, `plan-dark_blue_theme/REQ-42`
- `plan-popup_glass/REQ-1`, `plan-popup_glass/REQ-2`, `plan-popup_glass/REQ-3`, `plan-popup_glass/REQ-4`, `plan-popup_glass/REQ-6`
- `plan-cool_slate_light/REQ-1`, `plan-cool_slate_light/REQ-2`, `plan-cool_slate_light/REQ-3`, `plan-cool_slate_light/REQ-4`, `plan-cool_slate_light/REQ-5`, `plan-cool_slate_light/REQ-6`, `plan-cool_slate_light/REQ-7`
- `plan-cool_slate_light/REQ-8`, `plan-cool_slate_light/REQ-10`, `plan-cool_slate_light/REQ-11`, `plan-cool_slate_light/REQ-13`, `plan-cool_slate_light/REQ-14`, `plan-cool_slate_light/REQ-15`, `plan-cool_slate_light/REQ-16`
- `plan-cool_slate_light/REQ-17` to `plan-cool_slate_light/REQ-22`, `plan-cool_slate_light/REQ-24`
