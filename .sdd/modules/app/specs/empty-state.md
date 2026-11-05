---
module: app
component: EmptyState
type: UI component
---

# EmptyState

**Purpose** → what the main area shows when no session is open: the actions to start or resume one.

## Contract

Description:
- a block centred in the main area: an icon, a short text and two buttons, drawn with the board parts (type classes, `.btn`, colour roles). No board shows it.

Shows:
- a decorative icon (`SquareTerminalIcon`), 48 px, in `--on-surface-variant`.
- the text "Nessuna sessione aperta." (`.title-l`) and, below it, "Avvia una nuova sessione o riprendine una passata." (`.body-m`, `--on-surface-variant`).
- the button "Nuova sessione" with `PlusIcon` → filled `.btn` (`.label-l`), `--primary` background, `--on-primary` text.
- the button "Riprendi sessione" with `HistoryIcon` → outlined `.btn` (`.label-l`), transparent background, 1 px `--outline` border, `--on-surface-variant` text.
- on hover, each button takes an 8% layer of its text colour.

Actions:
- "Nuova sessione" → calls `onNewSession`.
- "Riprendi sessione" → calls `onResumeSession`.

## Rules and invariants

- Both buttons are native buttons, so they are reachable with Tab and triggered with Enter or Space.
- The block never makes the main area wider than the window.

## Dependencies

- IconSet
- ThemeTokens, WebEntry (global classes)

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-9`
- `plan-claude_sessions_client-ui_redesign/REQ-1`
- `plan-claude_sessions_client-ui_redesign/REQ-4`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-1`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-2`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-5`
