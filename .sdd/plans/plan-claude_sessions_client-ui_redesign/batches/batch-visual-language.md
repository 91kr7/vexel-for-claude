---
batch: visual-language
feature: Visual language and keyboard use
closed_req: [REQ-2, REQ-6, REQ-7]
depends: []
---

# Batch — Visual language

The base look of the whole client, in a light and a dark theme. All existing screens take it in this batch. Later batches build their screens on it. REQ-1, REQ-3 and REQ-5 start here and close in batch `feedback-states`.

Constraint → every requirement of `plan-claude_sessions_client` stays true (`requirements.md`, "Constraints on every batch").

## What this batch builds

- **Theme tokens** → the shared colours, type, spacing and focus ring of the client, in a light and a dark set.
- **Bundled font** → the UI font, shipped with the client.
- **Icon set** → the icons of the client, shipped with the client.

## Decisions for this batch

- **Font** → Inter, variable, latin subset, `woff2`, SIL OFL 1.1. The terminal keeps the font of xterm.js.
- **Icons** → Lucide, ISC licence. Only the icons the client uses are copied.
- **Shipped in the repository** (gatekeeper decision) → the font and icon files and their licence files are committed under `src/web/`. There is no new npm dependency.
- **Theme** → CSS only, with `prefers-color-scheme`. A change of the system setting applies at once, with no reload. There is no theme switch in the client.
- **Terminal** → it keeps its own dark colours in both themes. The client does not change Claude Code's output.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | frontend, app area | Theme tokens: CSS custom properties for colours, type, spacing, radii, icon size, state colours and the focus ring. One light and one dark set, chosen by `prefers-color-scheme`, both with WCAG 2.2 AA contrast. | REQ-1, REQ-2, REQ-3, REQ-5 | — |
| INT-2 | create | frontend, app area | Bundled font: the Inter `woff2` file and its OFL licence file. `@font-face` loads it from the client's own files. | REQ-1, REQ-6, REQ-7 | — |
| INT-3 | create | frontend, app area | Icon set: the Lucide icons the client uses, as local SVG components, with the Lucide licence file. | REQ-1, REQ-6, REQ-7 | — |
| INT-4 | create | repository root | Third-party notices file: one entry per font and icon set, with its source, version and licence. | REQ-7 | INT-2, INT-3 |
| INT-5 | modify | `src/web/styles.css` | Rewrite the global styles on the INT-1 tokens and the INT-2 font: text, buttons (primary, secondary, danger), inputs, lists, modals and a `:focus-visible` ring. | REQ-1, REQ-3, REQ-5 | INT-1, INT-2 |
| INT-6 | modify | `src/web/index.html` | Declare `color-scheme: light dark`, so scrollbars and native controls follow the theme. | REQ-2 | — |

## Human acceptance

### Scenario: The client follows the dark theme of the system

- REQ → REQ-2
- Given → the operating system uses the light theme and the client is open
- When → the user sets the operating system to the dark theme
- Then → the client turns dark at once, with no reload
- And → the terminal of a hosted session keeps its own colours

### Scenario: The client draws its pages with no internet connection

- REQ → REQ-6
- Given → the machine has no internet connection
- When → the user opens the client
- Then → the page shows its font and its icons, and the browser network panel lists only requests to the client

### Scenario: The user finds the licence of each font and icon set

- REQ → REQ-7
- Given → the repository of the client
- When → the user opens the third-party notices file
- Then → each font and icon set is listed with its source and licence, and its licence file is in the repository
