---
module: app
component: ThemeTokens
type: configuration
---

# ThemeTokens

**Purpose** → the shared CSS custom properties of the client: one dark set, from the `:root` block of `.sdd/mockups/studio-dark/mock.html`, with a light-blue accent.

## Contract

- The tokens are custom properties on `:root`. Every style of the client takes its colours from them.
- One set only. There is no light set and no `prefers-color-scheme` rule. The system theme changes nothing.
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
- Names kept because components read them:
  - `--term-bg` → `--bg-canvas`, `--term-fg` → `--text-primary`
  - `--color-error` → `--rose-400`
  - `--color-focus-ring` → `--accent-primary`
  - `--color-backdrop` → black at 65 %
- Other groups: `--font-ui` (Roboto Flex), `--font-mono` (Roboto Mono), `--focus-ring-width` and `--focus-ring-offset` (2 px), and the Tailwind shadows `--shadow-sm`, `--shadow`, `--shadow-lg`, `--shadow-2xl`.
- The Material 3 roles (`--primary`, `--sc-*`, …), the other `--color-*` names and the type, spacing and radius scales no longer exist.

## Rules and invariants

- No token is orange, indigo, violet or pink.
- `--text-primary`, `--text-secondary` and `--text-muted` reach 4.5:1 on canvas and on surfaces 1, 2 and 3. `--text-muted` is the least lightening of the mock value that reaches it on surface 3 (about 4.56:1).
- `--on-accent` on `--accent-primary` reaches 4.5:1 (about 11.7:1), and on `--accent-deep` too (about 5.8:1).
- `--font-ui` and `--font-mono` load the BundledFont files.

## Dependencies

- BundledFont

## Requirements served

- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-3`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-4`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-5`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-6`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-8`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-51`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-52`
- `plan-claude_sessions_client-ui_redesign/REQ-1`, `plan-claude_sessions_client-ui_redesign/REQ-3`
