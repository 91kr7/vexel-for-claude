---
batch: light-theme
feature: Light theme
closed_req: REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16
depends: —
---

# Batch — Light theme

The client gets a light theme, taken from the mock's editorial-light theme, and a sun/moon button in the top bar that switches between light and dark. The REQ ids refer to `plan-light_theme/requirements.md`.

## What this batch builds

- **Theme store** (app area, frontend) → holds the active theme, marks it on the page root, and toggles it. The page restyles from that mark only.
- **Theme switch** (app area, UI) → the sun/moon icon button of the top bar that toggles the theme.

## Visual reference

- `.sdd/mockups/studio-dark/mock.html`, block `[data-theme="editorial-light"]` (lines 46–63) → the light values. Read them from the file.
- The same file, top-bar icon buttons "Search Sessions" and "Settings" (lines 360–366) → the look of the switch.
- The mock uses the same backdrop (`bg-black/65`), shadows and glass shadow in both themes.

## Decisions for this batch

- **One mark on the page root.** The dark set stays on `:root`, unchanged. The light set overrides the tokens when the root carries the light mark. No component reads the theme by itself, except the switch for its icon and name.
- **Start theme.** Until `remembered-theme`, the client starts dark, as today. That batch adds the saved choice and the light default.
- **Light accent.** Same hue as the dark accent (205°). The light `--accent-primary` is the lightest tone of that hue that reaches 4.5:1 as text on canvas and surfaces 1–3, and with `--on-accent` on it. Glow and border are that tone at the mock's light opacities (12 % and 35 %). The focus ring uses it too, so the ring stays visible on the light surfaces.
- **Light status colours.** Darker tones of the same Tailwind families (emerald, amber, rose, zinc), the lightest that reach 4.5:1 on the light surfaces. Components keep reading the same token names, so they do not change.
- **Terminal stays dark.** `--term-bg` and `--term-fg` keep today's dark values in both themes. The terminal cursor and selection get their own tokens, also fixed to today's values.
- **The switch.** A 32 × 32 px button in the mock's top-bar icon-button style. Moon icon in the dark theme, sun icon in the light theme. Accessible name "Dark theme", with `aria-pressed` true in the dark theme. Its tooltip is the same text.
- **Literal colours.** The ThemeTokens contract says every style takes its colours from the tokens. A literal colour that the developer finds and that breaks the light theme moves into a token, in this batch.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/theme/tokens.css` | Add the light set: canvas, surfaces 1–3, glass, borders, top highlight and text colours with the mock's editorial-light values. It applies under the light mark on the page root. Fonts, sizes and the dark set stay as they are. | REQ-6, REQ-7, REQ-8, REQ-10, REQ-13 | — |
| INT-2 | modify | `src/web/theme/tokens.css` | In the light set, darken a text colour that fails 4.5:1 on canvas or surfaces 1–3 (the mock's muted `#8a847c` does), only as much as needed. | REQ-14 | INT-1 |
| INT-3 | modify | `src/web/theme/tokens.css` | Light accent family: `--accent-primary`, `--accent-secondary`, `--accent-deep`, glow, border, selection, `--on-accent` and the focus ring, as set in "Decisions". | REQ-9, REQ-14, REQ-15 | INT-1 |
| INT-4 | modify | `src/web/theme/tokens.css` | Light status colours and their tints, as set in "Decisions". Working, needs input, error, waiting and ended stay distinct from each other. | REQ-14, REQ-16 | INT-1 |
| INT-5 | modify | `src/web/theme/tokens.css` | Keep `--term-bg` and `--term-fg` at today's dark values in both themes. Add terminal cursor and selection tokens with today's values. | REQ-12 | INT-1 |
| INT-6 | modify | `src/web/sessions/SessionView.tsx` | The xterm cursor and selection read the terminal tokens of INT-5, not the accent tokens. The panel stays on `--term-bg`. | REQ-12 | INT-5 |
| INT-7 | modify | `src/web/index.html`, `src/web/styles.css` | `color-scheme` follows the active theme, in place of "dark only". So scrollbars and native controls render light in the light theme. | REQ-11, REQ-13 | INT-1 |
| INT-8 | create | app area, frontend | Theme store: holds the active theme, sets the mark on the page root, and toggles it. A change only moves the mark: nothing remounts or reconnects. | REQ-3, REQ-4 | INT-1 |
| INT-9 | modify | `src/web/icons/Icons.tsx` | Add the Lucide sun and moon icons, from the same Lucide version as the set. | REQ-2 | — |
| INT-10 | create | app area, UI | Theme switch: the icon button set in "Decisions". It shows the icon of the active theme, toggles the theme store, and has the shared focus ring. | REQ-2, REQ-3, REQ-5 | INT-8, INT-9 |
| INT-11 | modify | `src/web/TopBar.tsx` | Show the theme switch on the right of the bar, before "New Session". | REQ-1 | INT-10 |

The developer updates the specs and the indexes: ThemeTokens (no longer "one set only"), WebEntry (no longer "dark only"), TopBar (no longer "no other control"), SessionView, IconSet, and the two new components.

## Human acceptance

### Scenario: The user switches the client to the light theme

- REQ → REQ-1, REQ-2, REQ-3, REQ-4, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-14, REQ-15, REQ-16
- Given → the client is dark, a hosted session is open, and the session list is scrolled down
- When → the user clicks the moon button in the top bar
- Then → the whole client turns to the light paper look with a light-blue accent, the button shows a sun, and the terminal panel stays dark
- And → the same session stays open and running, and the list keeps its scroll position

### Scenario: An external session reads well in the light theme

- REQ → REQ-6, REQ-14, REQ-16
- Given → the client is light
- When → the user opens an external session with tool calls
- Then → messages, tool cards and tool output are on light surfaces, and all text and state colours are readable

### Scenario: The user goes back to the dark theme with the keyboard

- REQ → REQ-2, REQ-3, REQ-5, REQ-13
- Given → the client is light
- When → the user moves the focus to the sun button with Tab and presses Enter
- Then → the button shows the focus ring, then a moon, and the client looks exactly as it did before this change
