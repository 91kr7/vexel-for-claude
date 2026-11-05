---
module: app
component: ThemeTokens
type: configuration
---

# ThemeTokens

**Purpose** → the shared CSS custom properties of the client, in a light and a dark set.

## Contract

- The tokens are custom properties on `:root`. Every style of the client takes its values from them.
- Colour roles → the role names of the `.m3` and `.m3.dark` rules of the four mock boards (`.sdd/mockups/vexel-material3/`):
  - primary family → `--primary`, `--on-primary`, `--primary-container`, `--on-primary-container`, `--inverse-primary`
  - neutrals → `--secondary-container`, `--on-secondary-container`, `--surface`, `--on-surface`, `--on-surface-variant`, `--outline`, `--outline-variant`, `--sc-lowest`, `--sc-low`, `--sc`, `--sc-high`, `--sc-highest`, `--dialog`, `--inverse-surface`, `--inverse-on-surface`
  - terminal → `--term-bg`, `--term-fg`, `--term-dim`
  - status → `--teal-container`, `--on-teal-container`, `--error`, `--on-error`, `--error-container`, `--on-error-container`, `--attn`, `--attn-container`, `--on-attn-container`, `--ok`, `--ok-container`, `--on-ok-container`, `--ember`
- Palette swap of the mock:
  - the primary family is light blue: HSL hue 205° ±2.
  - the neutrals and the terminal roles are grey: CIELAB a* and b* within ±2.
  - each swapped colour has the CIELAB L* of the board colour it replaces, within ±2, in both sets.
  - the status roles have the board values.
- Other groups:
  - type → `--font-ui` (Roboto Flex), `--font-mono` (Roboto Mono), `--font-size-{xs,sm,md,lg,xl}`, `--font-weight-{regular,medium,semibold}`, `--line-height`
  - spacing → `--space-{1,2,3,4,6}`
  - radii → `--radius-{sm,md,lg,full}`
  - icon size → `--icon-size` (20 px, as the board `.icon`)
  - focus ring → `--focus-ring-width`, `--focus-ring-offset`, `--color-focus-ring`
- Old names, kept until no component uses them, point to the roles:

| Old name | Role |
|----------|------|
| `--color-bg` | `--surface` |
| `--color-surface` | `--sc-low` |
| `--color-surface-hover` | `--sc-high` |
| `--color-surface-selected` | `--secondary-container` |
| `--color-border` | `--outline-variant` |
| `--color-border-strong` | `--outline` |
| `--color-text` | `--on-surface` |
| `--color-text-muted`, `--color-state-ended`, `--color-external` | `--on-surface-variant` |
| `--color-primary`, `--color-focus-ring`, `--color-state-working` | `--primary` |
| `--color-on-primary` | `--on-primary` |
| `--color-primary-hover` | `--primary` with 8% of `--on-primary` |
| `--color-danger`, `--color-error` | `--error` |
| `--color-on-danger` | `--on-error` |
| `--color-danger-hover` | `--error` with 8% of `--on-error` |
| `--color-state-needs-input`, `--color-warning` | `--attn` |
| `--color-state-needs-input-bg` | `--attn-container` |
| `--color-state-idle`, `--color-success` | `--ok` |
| `--terminal-background` | `--term-bg` |

- `--color-backdrop` and `--shadow-modal` keep their own values, per set.
- The colour set follows `prefers-color-scheme`. Light is the default. Dark applies when the system asks for dark.
- A change of the system setting applies at once, with no reload.

## Rules and invariants

- No colour token is violet, purple or pink. The board tertiary roles (pink) are not defined: no board uses them.
- In both sets, every text and state colour reaches 4.5:1 on `--color-bg`, `--color-surface`, `--color-surface-hover` and `--color-surface-selected`.
- In both sets, `--color-text`, `--color-text-muted` and `--color-state-needs-input` reach 4.5:1 on `--color-state-needs-input-bg`.
- `--color-on-primary` on `--color-primary` and `--color-on-danger` on `--color-danger`, hover included, reach 4.5:1.
- `--color-focus-ring` and `--color-border-strong` reach 3:1 on `--color-bg` and `--color-surface`.
- `--term-bg` is dark grey in both sets, as in the boards. `--term-fg` is the same light grey in both sets.
- `--font-ui` and `--font-mono` load the BundledFont files.

## Dependencies

- BundledFont

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-1`
- `plan-claude_sessions_client-ui_redesign/REQ-2`
- `plan-claude_sessions_client-ui_redesign/REQ-3`
- `plan-claude_sessions_client-ui_redesign/REQ-5`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-1`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-2`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-3`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-4`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-5`
