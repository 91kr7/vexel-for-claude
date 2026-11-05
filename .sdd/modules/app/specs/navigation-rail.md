---
module: app
component: NavigationRail
type: UI component
---

# NavigationRail

**Purpose** → the left column of the page: the logo, the "Nuova sessione" button and the destinations "Sessioni" and "Riprendi". It copies the `nav` of board "Sessione ospitata".

## Contract

Props:
- `needsInputCount` → the number of sessions in `needs_input`.
- `onNewSession()`, `onShowSessions()`, `onResume()` → called on a click of the matching button.
- `newSessionRef` → optional ref that receives the "Nuova sessione" button.

Description:
- a `nav` with the label "Navigazione principale". One column, 96 px wide, items centred, 12 px gap, 20 px top and bottom padding, `--surface` background.

Shows, top to bottom:
- the logo → an SVG image (`role="img"`, label "Vexel"), 36 × 29 px, 4 px margin above and 12 px below. Seven 5 px squares with 1.5 px radius: six in `--primary`, the bottom one in `--ember`.
- "Nuova sessione" → a button with that accessible name and only a plus icon (24 px). 56 × 56 px, 16 px radius, no border, `--primary-container` background, `--on-primary-container` icon, shadow `0 1px 3px rgba(0,0,0,.18)`.
- a 12 px empty space.
- "Sessioni" → a button with `aria-current="page"`, always. A 56 × 32 px indicator with 16 px radius, `--secondary-container` background and the terminal icon in `--on-secondary-container`; under it, 4 px apart, the text "Sessioni" (`.label-m`, `--on-surface`).
- the badge on the "Sessioni" indicator → the number `needsInputCount`, at 4 px above the top and 6 px from the right of the indicator. At least 16 px wide, 16 px high, 0 4 px padding, 8 px radius, `--error` background, `--on-error` text, 11/16 px `.label-m`, centred. Not shown when the number is 0. It is hidden from assistive technology: the accessible name of the button stays "Sessioni".
- "Riprendi" → a button laid out as "Sessioni", with no indicator background, the history icon and the text "Riprendi", both in `--on-surface-variant`. No `aria-current`.

Actions:
- click on "Nuova sessione" → `onNewSession()`.
- click on "Sessioni" → `onShowSessions()`.
- click on "Riprendi" → `onResume()`.

## Rules and invariants

- The icons are decorative. The accessible names are "Nuova sessione", "Sessioni" and "Riprendi".
- Hover → "Nuova sessione" and the "Riprendi" indicator get an 8 % state layer of their text colour.

## Dependencies

- IconSet (`PlusIcon`, `TerminalIcon`, `HistoryIcon`)

## Requirements served

- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-6`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-9`
