---
module: app
component: EmptyState
type: UI component
---

# EmptyState

**Purpose** → what the main area shows when no session is open: the actions to start or resume one. It is `#orchestrator-empty-state` of the mock.

## Contract

Shows:
- an AreaState `full`, kind `empty`, with the terminal tile.
- the title "Nessuna sessione aperta." and the text "Avvia una nuova sessione o riprendine una passata.".
- the button "Nuova sessione" with `PlusIcon` → `.button-primary`.
- the button "Riprendi sessione" with `HistoryIcon` → `.button-neutral`.

Actions:
- "Nuova sessione" → calls `onNewSession`.
- "Riprendi sessione" → calls `onResumeSession`.

## Rules and invariants

- Both buttons are native buttons, reachable with Tab and triggered with Enter or Space.
- The block never makes the main area wider than the window.

## Dependencies

- AreaState, IconSet, WebEntry

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-9`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-50`
