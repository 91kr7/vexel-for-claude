---
batch: colours-type
feature: Colours and type
closed_req: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5]
depends: []
---

# Batch — Colours and type

The colour roles and the fonts of the mock, with light blue and grey in place of violet. Every existing screen takes them in this batch. Later batches redraw each screen on them.

Constraint → every requirement of `plan-claude_sessions_client` and `plan-claude_sessions_client-ui_redesign` stays true. This includes the WCAG 2.2 AA contrast, the visible focus and no request to outside servers.

## Visual reference

Board files → all four, because the colour roles are spread across them:
- `.sdd/mockups/vexel-material3/proposta-sessione-ospitata.html`
- `.sdd/mockups/vexel-material3/proposta-sessione-esterna.html`
- `.sdd/mockups/vexel-material3/proposta-dialoghi.html`
- `.sdd/mockups/vexel-material3/proposta-voci-elenco.html`

Read `.sdd/mockups/vexel-material3/README.md` first. The colour roles are in the `.m3` and `.m3.dark` rules. The type classes (`.brand`, `.label-l`, `.title-m`, …), `.btn`, `.chip` and `.icon` are in the `<style>` block inside `<helmet>`.

## What this batch builds

- No new component. It rebuilds the colour roles, the fonts and the base styles that every screen uses.
- To the developer: the result must be IDENTICAL to the mock board — open the board file and copy its layout, sizes, radii, spacing, typography, icons and texts; a description is not a substitute. The only change is the palette below.

## Decisions for this batch

- **Light blue** → a sky-blue hue, about 205° in HSL. Each role keeps the CIELAB L* of the mock colour it replaces, within ±2 (REQ-4). In the light theme this gives a darker blue for text and filled buttons. That is expected.
- **Neutral grey** → CIELAB a* and b* within ±2, at the L* of the mock colour.
- **Swapped roles** → the primary family (`--primary`, `--on-primary`, `--primary-container`, `--on-primary-container`, `--inverse-primary`) becomes light blue. `--secondary-container`, `--on-secondary-container`, `--surface`, `--on-surface`, `--on-surface-variant`, `--outline`, `--outline-variant`, `--sc-*`, `--dialog`, `--inverse-surface`, `--inverse-on-surface` and `--term-*` become grey.
- **Kept roles** → teal, tertiary, error, `--attn*`, `--ok*` and `--ember` keep the mock values.
- **Fonts** → `roboto-flex-latin.woff2` (400–800, width 25–151) and `roboto-mono-latin.woff2` (400 and 500), copied from the mock folder. Their licence is SIL OFL 1.1. Inter is removed.
- **Terminal colours** → `--term-bg` and `--term-fg` of the active theme, as in the boards. The terminal keeps the colours that Claude Code writes.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/theme/tokens.css` | Replace the colour set with the colour roles of the `.m3` and `.m3.dark` rules of the four boards, with the palette swap of this batch. IDENTICAL role names and kept values to the board files. | REQ-1, REQ-2, REQ-3, REQ-4 | — |
| INT-2 | modify | `src/web/theme/tokens.css` | The old token names (`--color-primary`, `--color-surface`, …) point to the matching new roles, until no component uses them. The contrast invariants of the ThemeTokens spec stay true. | REQ-1, REQ-2, REQ-3 | INT-1 |
| INT-3 | modify | `src/web/fonts/` (BundledFont) | Replace Inter with Roboto Flex and Roboto Mono, copied from the mock folder. `@font-face` as in the boards, latin files only. The OFL licence file sits next to them with the Roboto copyright lines. | REQ-5 | — |
| INT-4 | modify | `THIRD-PARTY-NOTICES.md` | Add one entry for Roboto Flex and one for Roboto Mono, with their files and licence. Remove the Inter entry. | REQ-5 | INT-3 |
| INT-5 | modify | `src/web/styles.css` | `--font-ui` = Roboto Flex, `--font-mono` = Roboto Mono. Add the board classes `.brand`, type scale, `.btn`, `.chip` and `.icon` as global styles, IDENTICAL to the board `<style>` block. | REQ-1, REQ-5 | INT-1, INT-3 |
| INT-6 | modify | `src/web/sessions/SessionView.tsx` | The xterm terminal uses Roboto Mono, loaded before the terminal opens and fits. Its background and text use `--term-bg` and `--term-fg` of the active theme. | REQ-2, REQ-5 | INT-1, INT-3 |
| INT-7 | modify | `src/web/EmptyState.tsx` | Redraw the empty state with the board parts: type classes, `.btn` buttons, colour roles. It keeps its texts and its two actions. No board shows it. | REQ-1, REQ-2, REQ-5 | INT-5 |

## Human acceptance

### Scenario: The user sees light-blue accents, grey surfaces and the Roboto fonts

- REQ → REQ-1, REQ-2, REQ-3, REQ-5
- Given → the operating system uses the light theme and no session is open
- When → the user opens the client
- Then → "Nuova sessione" is light blue, the surfaces are neutral grey with no violet tint, and the text is in Roboto Flex
- And → the browser network panel lists only requests to the client

### Scenario: The dark theme keeps the lightness of the mock

- REQ → REQ-1, REQ-2, REQ-4
- Given → the client is open and a hosted session is open
- When → the user sets the operating system to the dark theme
- Then → the client turns dark at once, the accents are light blue, and the terminal is dark grey with Roboto Mono text
- And → each colour has the same lightness as the colour of the board it replaces
