---
batch: font-zoom
feature: Font zoom
closed_req: [REQ-32, REQ-33, REQ-34, REQ-35, REQ-36, REQ-37, REQ-38, REQ-39, REQ-40, REQ-41, REQ-42, REQ-43, REQ-44, REQ-45]
depends: [clickable-links]
---

# Batch font-zoom — Font zoom

The REQs are in `.sdd/plans/plan-terminal_addons/requirements.md`. "The terminal" is the xterm.js terminal of SessionView. "In the terminal" means while the terminal has the keyboard focus. "Undo" is Ctrl+_, which xterm.js sends for Ctrl+Shift+-.

## What this batch builds

- **Terminal text size store** → the one text size of all hosted terminals: 8 to 32 px, default 12 px, saved in the page.
- **Terminal zoom controls** → three subbar buttons: "smaller", "default size" and "larger".

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | frontend, sessions area | Terminal text size store: one size for all terminals, 8 to 32 px in 1 px steps, default 12 px. Larger, smaller and reset, with change listeners. Saved in `localStorage` and read at start, like ThemeStore. | REQ-40, REQ-43, REQ-44 | — |
| INT-2 | modify | `src/web/icons/Icons.tsx` | Add `MinusIcon` from the same Lucide version, cited in `THIRD-PARTY-NOTICES.md`. `PlusIcon` exists. | REQ-35 | — |
| INT-3 | create | frontend, sessions area | Terminal zoom controls: "smaller", a "default size" button that shows the current size, and "larger". "larger" is disabled at 32 px, "smaller" at 8 px. Keyboard use, visible focus, accessible names. | REQ-35, REQ-41, REQ-45 | INT-1, INT-2 |
| INT-4 | modify | `src/web/sessions/SessionView.tsx` | Zoom keys in the terminal, matched on the character the key produces, Ctrl without Alt or Meta: `=` and `+` larger, `-` smaller, `0` reset. Nothing goes to the pty, and the browser default is prevented. `_` (undo) and Ctrl+Shift+L keep today's behaviour. | REQ-32, REQ-33, REQ-34, REQ-36, REQ-37, REQ-38, REQ-39 | INT-1 |
| INT-5 | modify | `src/web/sessions/SessionView.tsx` | The terminal takes its size from the store at open and on each change. After a change it fits the panel and sends `resize`. The zoom controls go in the subbar actions, before "Interrupt". | REQ-35, REQ-42, REQ-43 | INT-1, INT-3 |
| INT-6 | modify | `src/desktop/main.ts` | The window does not zoom the page on Ctrl+=, Ctrl++, Ctrl+- and Ctrl+0, and these keys still reach the page. The rest of the hidden menu stays as it is. | REQ-39 | — |

## Decisions

- **Shortcut check.** xterm.js 6 sends nothing to the pty today for Ctrl+-, Ctrl+=, Ctrl++ and Ctrl+0. So these keys take nothing from Claude Code. Undo is `_` and stays with Claude Code (`requirements.md`, "Assumptions").
- **Minimal desktop change.** INT-6 changes only the page zoom keys of the window. The developer picks the smallest way that leaves the Alt menu as it is.
- **Ended sessions.** Zoom also works on the terminal of an ended session (gatekeeper decision).
- **Specs.** The developer updates the SessionView, DesktopApp and IconSet specs, and writes the specs of the two new components.

## Tests

- Run e2e with `E2E_PORT` and `E2E_CLAUDE_DIR` set for this cycle (batch `clickable-links`, INT-1 and INT-2).
- Browser e2e: the fake CLI can report its rows and columns after a `resize` (REQ-42).
- Electron group (`npm run test:e2e:desktop`), one check only: Ctrl+= in the terminal leaves the page zoom of the window unchanged and makes the terminal text larger (REQ-39). Everything else is checked by Vitest or by the browser e2e.

## Human acceptance

### Scenario: The user makes the terminal text larger

- REQ → REQ-32, REQ-37, REQ-39, REQ-42, REQ-43
- Given → the terminal has the focus and its text is 12 px
- When → the user presses Ctrl+=
- Then → the terminal text is 13 px and fills the panel again with fewer columns. The list, the subbar and the top bar keep their size, and nothing is typed in Claude Code.
- And → another hosted session, opened next, shows its text at 13 px

### Scenario: The user makes the text smaller and restores it

- REQ → REQ-33, REQ-34
- Given → the terminal has the focus and its text is 14 px
- When → the user presses Ctrl+-, then Ctrl+0
- Then → the text goes to 13 px, then back to 12 px

### Scenario: The user reaches the largest size with the controls

- REQ → REQ-35, REQ-40, REQ-41, REQ-45
- Given → the terminal text is 31 px
- When → the user moves to "larger" with Tab and presses Enter
- Then → the text is 32 px and "larger" is disabled. Each control shows a visible focus.

### Scenario: The client keeps the size after a reload

- REQ → REQ-44
- Given → the user set the terminal text to 16 px
- When → the user reloads the page, or restarts the desktop app
- Then → the terminal text is 16 px

### Scenario: The zoom keys leave other keys alone

- REQ → REQ-36, REQ-38
- Given → the focus is on the session list, and the terminal text is 12 px
- When → the user presses Ctrl+=
- Then → the terminal text stays at 12 px
- And → in the terminal, Ctrl+Shift+- still undoes the last edit in Claude Code's input
