---
module: app
component: ThemeTokens
type: configuration
---

# ThemeTokens

**Purpose** → the shared CSS custom properties of the client, in a light and a dark set.

## Contract

- The tokens are custom properties on `:root`. Every style of the client takes its values from them.
- Groups:
  - type → `--font-ui`, `--font-mono`, `--font-size-{xs,sm,md,lg,xl}`, `--font-weight-{regular,medium,semibold}`, `--line-height`
  - spacing → `--space-{1,2,3,4,6}`
  - radii → `--radius-{sm,md,lg,full}`
  - icon size → `--icon-size`
  - focus ring → `--focus-ring-width`, `--focus-ring-offset`, `--color-focus-ring`
  - surfaces and text → `--color-bg`, `--color-surface`, `--color-surface-hover`, `--color-surface-selected`, `--color-border`, `--color-border-strong`, `--color-text`, `--color-text-muted`, `--color-backdrop`, `--shadow-modal`
  - actions → `--color-primary`, `--color-primary-hover`, `--color-on-primary`, `--color-danger`, `--color-danger-hover`, `--color-on-danger`
  - states → `--color-state-needs-input`, `--color-state-needs-input-bg`, `--color-state-working`, `--color-state-idle`, `--color-state-ended`, `--color-external`, `--color-error`, `--color-warning`, `--color-success`
  - terminal → `--terminal-background`
- The colour set follows `prefers-color-scheme`. Light is the default. Dark applies when the system asks for dark.
- A change of the system setting applies at once, with no reload.

## Rules and invariants

- In both sets, every text and state colour reaches 4.5:1 on `--color-bg`, `--color-surface`, `--color-surface-hover` and `--color-surface-selected`.
- In both sets, `--color-text`, `--color-text-muted` and `--color-state-needs-input` reach 4.5:1 on `--color-state-needs-input-bg`.
- `--color-on-primary` on `--color-primary` and `--color-on-danger` on `--color-danger`, hover included, reach 4.5:1.
- `--color-focus-ring` and `--color-border-strong` reach 3:1 on `--color-bg` and `--color-surface`.
- `--terminal-background` is the same dark colour in both sets. The terminal keeps its own colours.
- Only `--font-ui` loads a font file, the BundledFont. `--font-mono` uses fonts installed on the system.

## Dependencies

- BundledFont

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-1`
- `plan-claude_sessions_client-ui_redesign/REQ-2`
- `plan-claude_sessions_client-ui_redesign/REQ-3`
- `plan-claude_sessions_client-ui_redesign/REQ-5`
