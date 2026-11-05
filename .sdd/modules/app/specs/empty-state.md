---
module: app
component: EmptyState
type: UI component
---

# EmptyState

**Purpose** → what the main area shows when no session is open: the actions to start or resume one.

## Contract

Description:
- a block centred in the main area: an icon, a short text and two buttons.

Shows:
- a decorative icon (`SquareTerminalIcon`).
- the text "Nessuna sessione aperta." and, below it, "Avvia una nuova sessione o riprendine una passata."
- the button "Nuova sessione" with the primary look and `PlusIcon`.
- the button "Riprendi sessione" with the secondary look and `HistoryIcon`.

Actions:
- "Nuova sessione" → calls `onNewSession`.
- "Riprendi sessione" → calls `onResumeSession`.

## Rules and invariants

- Both buttons are native buttons, so they are reachable with Tab and triggered with Enter or Space.
- The block never makes the main area wider than the window.

## Dependencies

- IconSet

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-9`
- `plan-claude_sessions_client-ui_redesign/REQ-1`
- `plan-claude_sessions_client-ui_redesign/REQ-4`
