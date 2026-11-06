---
batch: clickable-links
feature: Clickable links
closed_req: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13]
depends: []
---

# Batch clickable-links — Clickable links

The REQs are in `.sdd/plans/plan-terminal_addons/requirements.md`. "The terminal" is the xterm.js terminal of SessionView.

## What this batch builds

- **Link opener** → opens an `http` or `https` address outside the client window, and refuses any other scheme.
- **Web address links** → finds the `http` and `https` addresses in the terminal rows and gives their exact range.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `playwright.config.ts` | Enabling, for parallel cycles. The e2e port comes from `E2E_PORT`, default 3100. The base URL, the stored theme choice, the server `PORT` and the health URL follow it. Record `E2E_PORT` and `E2E_CLAUDE_DIR` in `.sdd/.archi`, "Commands". | — | — |
| INT-2 | modify | `e2e/claude-dir.ts` | Enabling, for parallel cycles. The fixture Claude Code folder comes from `E2E_CLAUDE_DIR`, default `<os tmp>/ai-client-e2e-claude` as today. | — | — |
| INT-3 | modify | `package.json` | Add `@xterm/addon-web-links`, same major as `@xterm/xterm`. Add it to the "Dependencies" table of `.sdd/.archi`. | REQ-1 | — |
| INT-4 | create | frontend, sessions area | Link opener: an `http`/`https` address opens in a new tab with no opener, so the client window never navigates. Any other scheme does nothing. | REQ-10, REQ-11, REQ-12 | — |
| INT-5 | create | frontend, sessions area | Web address links, built on `@xterm/addon-web-links`. Closing punctuation (`.`, `,`, `)` and similar) is not part of the address. An address continues on the next row when the row wraps, or when the address fills the row to its last column. | REQ-1, REQ-7, REQ-8 | INT-3 |
| INT-6 | modify | `src/web/sessions/SessionView.tsx` | Load the web address links in the terminal. Hover → underline and pointer cursor. Ctrl+click → link opener. A plain click keeps today's focus and selection and opens nothing. Underline in the terminal text colour. | REQ-1, REQ-3, REQ-5, REQ-6, REQ-13 | INT-4, INT-5 |
| INT-7 | modify | `src/web/sessions/SessionView.tsx` | Terminal hyperlinks (OSC 8) through the terminal's link handler, with the same hover and Ctrl+click rules as INT-6. A plain click opens nothing. | REQ-2, REQ-3, REQ-5, REQ-6, REQ-12 | INT-4 |
| INT-8 | modify | `src/web/sessions/SessionView.tsx` | Hover on a hyperlink whose text differs from its address → a tooltip near the pointer shows the address. It is readable over the dark panel in both themes, and hides when the pointer leaves. | REQ-4, REQ-13 | INT-7 |
| INT-9 | modify | `src/desktop/main.ts` | Window open handler of the window: an `http`/`https` address opens in the system default browser. No request ever opens an Electron window. Any other scheme does nothing. | REQ-9, REQ-11, REQ-12 | — |

## Decisions

- **Wrapped addresses.** Claude Code breaks long lines itself, so a wrapped address may not be marked as a soft wrap. INT-5 also joins a row that the address fills to the last column with the next row.
- **Desktop.** The page uses the same opener in the browser and in the desktop app. In the desktop app the main process receives the open request and passes it to the system browser (INT-9). INT-9 is the only desktop change of this batch.
- **Specs.** The developer updates the SessionView and DesktopApp specs, and writes the specs of the two new components.

## Tests

- e2e port and folder for this cycle: run with `E2E_PORT` and `E2E_CLAUDE_DIR` set, so that the run does not clash with another cycle (INT-1, INT-2).
- Browser e2e: the fake CLI prints the addresses and an OSC 8 hyperlink. A test can catch the new tab.
- Electron group (`npm run test:e2e:desktop`), one check only: a Ctrl+click opens the address through the system browser and opens no Electron window (REQ-9). Everything else is checked by Vitest or by the browser e2e.

## Human acceptance

### Scenario: The user opens a web address from the terminal with Ctrl+click

- REQ → REQ-1, REQ-3, REQ-5, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-13
- Given → Claude Code has written a sentence that ends with a long `https` address and a ".". The address wraps over two rows.
- When → the user holds Ctrl and clicks the address
- Then → the full address, without the final ".", opens in a new browser tab. In the desktop app it opens in the system default browser.
- And → the client still shows the session. While the pointer was over the address, the address was underlined and the pointer was a hand.

### Scenario: A plain click on a link opens nothing

- REQ → REQ-6
- Given → the terminal shows an `https` address
- When → the user clicks the address without Ctrl
- Then → nothing opens, the terminal has the focus, and the user can select text as before

### Scenario: The user sees the address behind a hyperlink

- REQ → REQ-2, REQ-4, REQ-5, REQ-13
- Given → Claude Code shows a hyperlink with the text "docs" that points to an `https` address
- When → the user moves the pointer over "docs"
- Then → "docs" is underlined and a readable tooltip shows the full address
- And → a Ctrl+click on "docs" opens that address

### Scenario: A link with another scheme does not open

- REQ → REQ-12
- Given → Claude Code shows a hyperlink that points to a `file:` address
- When → the user holds Ctrl and clicks it
- Then → nothing opens and the client still shows the session
