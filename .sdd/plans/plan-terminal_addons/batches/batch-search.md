---
batch: search
feature: Search
closed_req: [REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29, REQ-30, REQ-31]
depends: [clickable-links]
---

# Batch search — Search

The REQs are in `.sdd/plans/plan-terminal_addons/requirements.md`. "The terminal" is the xterm.js terminal of SessionView. "In the terminal" means while the terminal has the keyboard focus.

## What this batch builds

- **Terminal search box** → the box at the top right of the terminal panel: the search field, "previous", "next", "close" and the match count.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `package.json` | Add `@xterm/addon-search`, same major as `@xterm/xterm`. Add it to the "Dependencies" table of `.sdd/.archi`. | REQ-19 | — |
| INT-2 | modify | `src/web/icons/Icons.tsx` | Add `ChevronUpIcon` from the same Lucide version, cited in `THIRD-PARTY-NOTICES.md`. `SearchIcon`, `ChevronDownIcon` and `XIcon` exist. | REQ-25 | — |
| INT-3 | modify | `src/web/theme/tokens.css` | Tokens for a match and for the current match. They are fixed like the other terminal tokens, and readable on `--term-bg`. | REQ-22, REQ-31 | — |
| INT-4 | create | frontend, sessions area | Terminal search box: field, "previous", "next", "close", and "N of M" or "No results". Enter → next, Shift+Enter → previous, Esc → close. Keyboard use, visible focus, accessible names. | REQ-24, REQ-25, REQ-26, REQ-27, REQ-28, REQ-30 | INT-2 |
| INT-5 | modify | `src/web/sessions/SessionView.tsx` | Ctrl+Shift+F in the terminal (no Alt, no Meta, either case) opens the box and focuses its field. Nothing goes to the pty, and the browser default is prevented. Ctrl+Shift+L keeps today's behaviour. | REQ-14, REQ-16, REQ-17, REQ-18 | INT-4 |
| INT-6 | modify | `src/web/sessions/SessionView.tsx` | Add a "Search" icon button to the subbar actions, before "Interrupt". It opens the box and focuses its field. | REQ-15 | INT-4 |
| INT-7 | modify | `src/web/sessions/SessionView.tsx` | Search with `@xterm/addon-search` at each change of the field: plain text, ignore case, scrollback included. Highlight all matches and the current one (INT-3 tokens), scroll to the current one, pass the count to the box. Next and previous wrap. | REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25, REQ-26 | INT-1, INT-3, INT-4 |
| INT-8 | modify | `src/web/sessions/SessionView.tsx` | Esc or "close" → the box closes, the highlights go, and the terminal gets the focus. A new `sessionId` closes the box. No key typed in the box goes to the pty. | REQ-27, REQ-28, REQ-29 | INT-4 |

## Decisions

- **Ended sessions.** Search also works on the terminal of an ended session (gatekeeper decision).
- **Specs.** The developer updates the SessionView, ThemeTokens and IconSet specs, and writes the spec of the search box.

## Tests

- Run e2e with `E2E_PORT` and `E2E_CLAUDE_DIR` set for this cycle (batch `clickable-links`, INT-1 and INT-2).
- Browser e2e and Vitest only. This batch does not touch the desktop app, so the Electron group does not run.

## Human acceptance

### Scenario: The user finds a word in the terminal scrollback

- REQ → REQ-14, REQ-17, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-26, REQ-28, REQ-31
- Given → the terminal has the focus. Its scrollback holds "Error" three times, above the visible screen.
- When → the user presses Ctrl+Shift+F and types "error"
- Then → the search box at the top right shows "1 of 3" while the user types. All three matches are highlighted, the current one in another colour, and the terminal scrolls to it.
- And → Claude Code's input line has not changed

### Scenario: The user moves between the matches

- REQ → REQ-24, REQ-25, REQ-30
- Given → the search box shows "3 of 3"
- When → the user presses Enter
- Then → the box shows "1 of 3" and the terminal shows the first match
- And → Shift+Enter, and the "previous" control reached with Tab, go back to "3 of 3". Each control shows a visible focus.

### Scenario: The search finds nothing

- REQ → REQ-26
- Given → the search box is open
- When → the user types a text that the terminal does not hold
- Then → the box shows "No results" and nothing is highlighted

### Scenario: The user closes the search

- REQ → REQ-15, REQ-27, REQ-29
- Given → the user opened the search box with the "Search" control in the subbar, and a match is highlighted
- When → the user presses Esc
- Then → the box closes, the highlights go, and the user can type in the terminal again
- And → when the box is open and the user opens another session, the box closes

### Scenario: The search key works only in the terminal

- REQ → REQ-16, REQ-18
- Given → the focus is on the session list
- When → the user presses Ctrl+Shift+F
- Then → no search box opens
- And → in the terminal, Ctrl+Shift+L still moves the focus to the list
