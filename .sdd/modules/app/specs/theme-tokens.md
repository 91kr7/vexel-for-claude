---
module: app
component: ThemeTokens
type: configuration
---

# ThemeTokens

**Purpose** → the shared CSS custom properties of the client: a dark set from the `:root` block of `.sdd/mockups/studio-dark/mock.html` and a light set from its `[data-theme="editorial-light"]` block, both with a light-blue accent.

## Contract

- The tokens are custom properties on `:root`. Every style of the client takes its colours from them.
- Two sets. The dark set is on `:root`. The light set overrides it when the root carries `data-theme="light"` (the mark of ThemeStore). Any other mark, or none, gives the dark set.
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
  - `--color-backdrop` → black at 65 %
- Terminal tokens, the same in both sets: `--term-bg` `#0b0b0e`, `--term-fg` `#f3f2ee`, `--term-cursor` `#8ccfff`, `--term-selection` `rgba(140, 207, 255, 0.3)`.
- Window button tokens, the same in both sets: `--window-close` `#ff5f57`, `--window-minimize` `#febc2e`, `--window-maximize` `#28c840`, `--window-symbol` black at 52 %.
- Terminal search tokens, the same in both sets, in `#RRGGBB` form: `--term-match-bg` `#713f12` (a match), `--term-match-current-bg` `#92400e` and `--term-match-current-border` `#fcd34d` (the current match).
- Other groups, the same in both sets: `--font-ui` (Roboto Flex), `--font-mono` (Roboto Mono), `--focus-ring-width` and `--focus-ring-offset` (2 px), and the Tailwind shadows `--shadow-sm`, `--shadow`, `--shadow-lg`, `--shadow-2xl`.
### Light set

- Mock tokens, with the mock's editorial-light values:

| Token | Value |
|-------|-------|
| `--bg-canvas` | `#f4f1ea` |
| `--bg-surface-1` / `-2` / `-3` | `#fcfaf5` / `#efeae0` / `#e4ded2` |
| `--bg-glass` | `rgba(252, 250, 245, 0.86)` |
| `--border-subtle` / `--border-strong` | `#1c1917` at 8 % / 15 % |
| `--specular-top` | white at 75 % |
| `--text-primary` / `--text-secondary` | `#1c1917` / `#57534e` |
| `--text-muted` | `#67625c` (the mock's `#8a847c`, darkened, see rules) |

- Accent family, HSL hue 205° and saturation 100 % like the dark accent:

| Token | Value |
|-------|-------|
| `--accent-primary` | `#0065ae`: the lightest tone that reaches 4.5:1 on canvas and surfaces 1–3 |
| `--accent-secondary` | `#004c82`: CIELAB L* lower by the gap from the mock's `#c85228` to `#a13d19` (about 10.5) |
| `--accent-deep` | `#004577`: L* lower by the gap from `#c85228` to the logo's `#9a3412` (about 13.4) |
| `--accent-glow` / `--accent-border` | `--accent-primary` at 12 % / 35 % |
| `--accent-selection` | `--accent-primary` at 30 % |
| `--on-accent` | `#ffffff`, the mock's white text on accent fills |

- `--color-focus-ring` follows `--accent-primary`, as in the dark set.
- Status colours: the text tones take the lightest tone of their Tailwind v3 family that reaches 4.5:1 on canvas, on surfaces 1–3, and on the family's tint over them.

| Token | Value |
|-------|-------|
| `--emerald-400` | `#065f46` (emerald-800) |
| `--amber-300`, `--amber-400` | `#92400e` (amber-800) |
| `--rose-300`, `--rose-400` | `#9f1239` (rose-800) |
| `--zinc-400` | `#52525b` (zinc-600) |

- `--orange-400` → `#b62a12` (OKLCH L 0.51, chroma 0.18, hue 32), not a Tailwind tone: orange-800 sits too close to the amber `#92400e` (see rules).
- The 500 tones, their tints, `--color-backdrop`, the shadows, the fonts and `--term-size` keep the dark values. The mock uses the same ones in both themes.

### Removed

- The Material 3 roles (`--primary`, `--sc-*`, …), the other `--color-*` names and the type, spacing and radius scales no longer exist.

## Rules and invariants

- No accent token is orange, indigo, violet or pink, as the old mock's accents were. The amber and brown tokens of warnings, needs input and terminal search highlights are allowed. The orange tokens are an action colour, not an accent.
- In each set, `--text-primary`, `--text-secondary` and `--text-muted` reach 4.5:1 on canvas and on surfaces 1, 2 and 3.
- Dark `--text-muted` is the least lightening of the mock value that reaches it on surface 3 (about 4.56:1). Light `--text-muted` is the least darkening, same HSL hue and saturation (about 4.51:1).
- Dark: `--on-accent` on `--accent-primary` reaches 4.5:1 (about 11.7:1), and on `--accent-deep` too (about 5.8:1).
- Light: `--accent-primary` reaches 4.5:1 on canvas and surfaces 1–3 (about 4.51:1 on surface 3). `--on-accent` reaches 6.0:1 on it and 9.9:1 on `--accent-deep`.
- Light: the status text tones stay apart from each other: green, brown-orange, crimson and grey.
- `--orange-400` reaches 4.5:1 on surface 1 and on the `--orange-500-15` and `--orange-500-25` tints over it. Dark: about 8.3, 6.7 and 5.6:1. Light: about 6.0, 5.2 and 4.7:1.
- `--orange-400` keeps its OKLCH hue apart from `--amber-400` and `--rose-400` of the same set. Dark: 56 against 84 and 13. Light: 32 against 46 and 14, also with more chroma than the amber (0.18 against 0.13).
- The terminal tokens never change with the theme.
- `--window-symbol` over each window button colour reaches 3:1 (about 3.1:1 on the red, the lowest). 50 % would give 2.96:1.
- `--term-fg` reaches 4.5:1 on `--term-match-bg` (about 7.7:1) and on `--term-match-current-bg` (about 6.3:1). `--term-match-current-border` reaches 3:1 on `--term-bg` (about 13.6:1).
- `--font-ui` and `--font-mono` load the BundledFont files.

## Dependencies

- BundledFont

## Requirements served

- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-3`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-4`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-5`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-6`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-8`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-51`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-52`
- `plan-claude_sessions_client-ui_redesign/REQ-1`, `plan-claude_sessions_client-ui_redesign/REQ-3`
- `plan-mac_title_bar/REQ-22`, `plan-mac_title_bar/REQ-26`
- `plan-light_theme/REQ-6`, `plan-light_theme/REQ-7`, `plan-light_theme/REQ-8`, `plan-light_theme/REQ-9`, `plan-light_theme/REQ-10`, `plan-light_theme/REQ-12`, `plan-light_theme/REQ-13`, `plan-light_theme/REQ-14`, `plan-light_theme/REQ-15`, `plan-light_theme/REQ-16`
- `plan-terminal_addons/REQ-22`, `plan-terminal_addons/REQ-31`
- `plan-session_list_width/REQ-34`, `plan-session_list_width/REQ-35`
