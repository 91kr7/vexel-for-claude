---
status: validated
---

# Batches — Keyboard shortcuts and a shortcuts panel

Requirements → `requirements.md`. Batch files → `batches/`.

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| navigation | Navigation shortcuts | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11 | — | certified | The user opens the next session from the terminal |
| session-actions | Session action shortcuts | REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21 | navigation | certified | The user stops a working session from the keyboard, after the confirmation |
| shortcuts-panel | Shortcuts panel | REQ-22, REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29, REQ-30, REQ-31, REQ-32, REQ-33, REQ-34, REQ-35, REQ-36, REQ-37, REQ-38, REQ-39, REQ-40, REQ-41, REQ-42, REQ-43, REQ-44, REQ-45, REQ-46 | navigation, session-actions | certified | The user opens the shortcuts panel and finds every shortcut |

Execution order: navigation, then session-actions, then shortcuts-panel. Navigation builds the shortcut map and the key handler that the other two use. The panel comes last because it lists every shortcut.

## Assumptions and decisions

- **Placement of the new components.** The shortcut map, the key handler, the command channel, the short-message toast and the shortcuts panel go in module app, beside AppLayout. AppLayout owns the open session, the dialogs and the top bar. The shortcuts button goes beside TopBar. The navigation targets go in module sessions, beside `session-order.ts`, because they read the list order.
- **One map for the keys and the panel (REQ-26, REQ-28).** The key handler and the panel read the same shortcut map. A key cannot work without a row, and a row cannot exist without its key. This answers the spec risk about a panel that drifts from the real keys.
- **Actions stay where they are (REQ-15, REQ-17, REQ-18, REQ-20).** A shortcut does not call the server itself. It sends a command to the component that runs the action today: StopSessionButton, EndedEntryActions, ResumeHereButton, SessionList. So the confirmation, the warnings and the error messages stay the same.
- **Focus after an open by shortcut (REQ-10).** The session opens by the same path as a click. The focus stays where it was. When it was in the main view and that view goes away (from a hosted to an external session, or back), the new main view gets it.
- **Short message (REQ-9).** At the bottom centre of the window, for 4 s, like the drop message of SessionView. The needs-input snackbar stays at the bottom right, so the two never cover each other.
- **Shortcuts button position (REQ-22).** Right before the Light/Dark switch, 6 px apart, so the two icon buttons sit together and "New Session" stays at the right end.
- **Panel close button (REQ-29).** The panel has no primary action. Its footer shows one button, "Close", which acts like Esc.
- **No change in the desktop app (REQ-38).** Its menu bar stays hidden also on Alt, and its menu keys use Ctrl. The Electron e2e group checks a few Alt keys in the desktop window (knowledge base `electron-e2e-separate`).
- **Rules close in the last batch (REQ-34 to REQ-46).** Each batch adds keys through the same map and the same handler, so each batch serves the rules for its own keys. They close in shortcuts-panel, which adds the last key, the panel shortcut.

## Departures

None. The plan follows the spec. The answers of the requirements step are gatekeeper decisions, recorded in `requirements.md`.

## Coverage check

Every REQ → at least one INT. Every INT → at least one REQ. There is no enabling intervention.

REQ-34 to REQ-46 are served in more than one batch. They close in shortcuts-panel. Every other REQ is served and closed in a single batch.

| REQ | Closes in | INT |
|-----|-----------|-----|
| REQ-1 | navigation | navigation INT-1, INT-6 |
| REQ-2 | navigation | navigation INT-8 |
| REQ-3 | navigation | navigation INT-1, INT-6, INT-9, INT-10 |
| REQ-4 | navigation | navigation INT-1, INT-4, INT-7 |
| REQ-5 | navigation | navigation INT-1, INT-4, INT-7 |
| REQ-6 | navigation | navigation INT-1, INT-4, INT-7 |
| REQ-7 | navigation | navigation INT-1, INT-4, INT-7 |
| REQ-8 | navigation | navigation INT-4, INT-7 |
| REQ-9 | navigation | navigation INT-5, INT-7 |
| REQ-10 | navigation | navigation INT-7 |
| REQ-11 | navigation | navigation INT-7 |
| REQ-12 | session-actions | session-actions INT-2, INT-3 |
| REQ-13 | session-actions | session-actions INT-2, INT-3 |
| REQ-14 | session-actions | session-actions INT-1, INT-2, INT-4 |
| REQ-15 | session-actions | session-actions INT-4 |
| REQ-16 | session-actions | session-actions INT-1, INT-2, INT-6 |
| REQ-17 | session-actions | session-actions INT-1, INT-2, INT-5, INT-6 |
| REQ-18 | session-actions | session-actions INT-1, INT-2, INT-5, INT-6 |
| REQ-19 | session-actions | session-actions INT-1, INT-2, INT-7 |
| REQ-20 | session-actions | session-actions INT-7 |
| REQ-21 | session-actions | session-actions INT-2, INT-3 |
| REQ-22 | shortcuts-panel | shortcuts-panel INT-1, INT-3, INT-5 |
| REQ-23 | shortcuts-panel | shortcuts-panel INT-3 |
| REQ-24 | shortcuts-panel | shortcuts-panel INT-3, INT-5, INT-8 |
| REQ-25 | shortcuts-panel | shortcuts-panel INT-6, INT-7, INT-8 |
| REQ-26 | shortcuts-panel | shortcuts-panel INT-4, INT-6 |
| REQ-27 | shortcuts-panel | shortcuts-panel INT-4 |
| REQ-28 | shortcuts-panel | shortcuts-panel INT-4, INT-6 |
| REQ-29 | shortcuts-panel | shortcuts-panel INT-2, INT-3, INT-5, INT-7, INT-8 |
| REQ-30 | shortcuts-panel | shortcuts-panel INT-8 |
| REQ-31 | shortcuts-panel | shortcuts-panel INT-8 |
| REQ-32 | shortcuts-panel | shortcuts-panel INT-4 |
| REQ-33 | shortcuts-panel | shortcuts-panel INT-2, INT-4 |
| REQ-34 | shortcuts-panel | navigation INT-1; session-actions INT-2; shortcuts-panel INT-6 |
| REQ-35 | shortcuts-panel | navigation INT-1; session-actions INT-2; shortcuts-panel INT-6 |
| REQ-36 | shortcuts-panel | navigation INT-1; session-actions INT-2; shortcuts-panel INT-6 |
| REQ-37 | shortcuts-panel | navigation INT-1; session-actions INT-2; shortcuts-panel INT-6 |
| REQ-38 | shortcuts-panel | navigation INT-2 |
| REQ-39 | shortcuts-panel | navigation INT-1, INT-2, INT-8; session-actions INT-2; shortcuts-panel INT-6 |
| REQ-40 | shortcuts-panel | navigation INT-8; shortcuts-panel INT-6 |
| REQ-41 | shortcuts-panel | navigation INT-2 |
| REQ-42 | shortcuts-panel | navigation INT-3; shortcuts-panel INT-7 |
| REQ-43 | shortcuts-panel | navigation INT-4, INT-6, INT-7; session-actions INT-1, INT-4, INT-5 |
| REQ-44 | shortcuts-panel | navigation INT-8; shortcuts-panel INT-6 |
| REQ-45 | shortcuts-panel | navigation INT-1, INT-2; session-actions INT-2; shortcuts-panel INT-6 |
| REQ-46 | shortcuts-panel | navigation INT-2 |
