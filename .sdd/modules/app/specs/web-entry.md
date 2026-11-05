---
module: app
component: WebEntry
type: UI entry point
---

# WebEntry

**Purpose** → the HTML page, the script that mounts the React app, and the global styles with the shared classes of the mock.

## Contract

- the page has `lang="it"` and the title "Vexel for Claude".
- the page declares `color-scheme: dark` only, in the meta tag and on `:root`. Scrollbars and native controls are dark, also when the system theme is light.
- the script renders AppLayout in `#root`, with the global styles.
- body → `--bg-canvas` background, `--text-primary` text, Roboto Flex 14 px, line height 1.5.
- selected text → `--accent-selection` background.
- scrollbars → 5 px, transparent track, `--border-strong` thumb with full rounding. Browsers without `::-webkit-scrollbar` get `scrollbar-width: thin` in the same colours.
- the element with the keyboard focus, when focused from the keyboard, shows a 2 px `--accent-primary` ring 2 px away.
- buttons have no look of their own until a class gives one. A disabled button is dimmed to 55 % and shows the not-allowed cursor.
- `.icon` → 16 px, no fill, stroke in the text colour, width 2, round caps and joins.

Mock classes, the same as the `<style>` block of the mock:

| Class | Look |
|-------|------|
| `.vx-surface-1` / `-2` | the surface colour, 1 px `--border-subtle` border, inset 1 px `--specular-top` line on top |
| `.vx-surface-3` | `--bg-surface-3`, 1 px `--border-strong` border |
| `.vx-glass` | `--bg-glass`, 14 px backdrop blur, 1 px `--border-strong` border, top line and `0 12px 32px -8px` black at 35 % |
| `.vx-dot-grid` | 1 px dots in `--border-strong` every 18 px |
| `.kbd-badge` | mono 10 px, padding 1 × 5 px, 4 px radius, `--bg-surface-3`, `--border-subtle` border, `--text-muted` |
| `.accent-pill` | `--accent-glow` background, `--accent-primary` text, `--accent-border` border |
| `.vx-pulse` | Tailwind `animate-pulse`: opacity to 0.5 and back every 2 s |

Client classes built from the mock's parts:

| Class | Look (mock source) |
|-------|-------------------|
| `.section-label` | mono 10 px, uppercase, letter spacing 0.05em, `--text-muted` ("Orchestrated Sessions") |
| `.section-label-path` | with `.section-label`: no uppercase, long text wraps |
| `.mono-chip` | mono 10 px, padding 2 × 6 px, 4 px radius, `--text-secondary`; used with `.vx-surface-2` (`#subbar-model`) |
| `.button-neutral` | 12/16 px, padding 6 × 12 px, 8 px radius, the `.vx-surface-2` look, `--text-primary`; hover → surface 3 and strong border ("Cancel") |
| `.button-primary` | 12/16 px weight 500, padding 6 × 16 px, 8 px radius, `--accent-primary` fill, `--on-accent` text, Tailwind `shadow` ("Start Session") |
| `.button-bar` | with `.button-primary`: 32 px high, padding 0 × 10 px, `shadow-sm`, scaled to 95 % while pressed (top-bar "New Session") |
| `.button-danger` | mono 11 px, padding 4 × 10 px, 6 px radius, rose-500 at 15 % fill, rose-400 text, rose-500 at 30 % border; hover → fill at 25 % (`#subbar-stop-btn`) |
| `.button-attn` | `.button-danger` in amber |
| `.field`, `.field-label`, `.field-input` | label mono 11 px `--text-secondary`, 4 px above the input. Input mono 12 px, padding 8 × 12 px, 8 px radius, `--bg-canvas`, `--border-subtle` border; on focus no ring and the border becomes `--accent-border` (`#new-sess-dir`) |

- the font is Roboto Mono wherever the mock uses JetBrains Mono, and Roboto Flex wherever it uses Plus Jakarta Sans or Instrument Serif. Where the mock asks mono 600 or 700, the client uses 500.
- with `prefers-reduced-motion: reduce`, the pulse, the spinner and the progress bar do not move.

## Rules and invariants

- No style loads a file from another server. The Tailwind CDN and the Google fonts of the mock are not used.
- The Material 3 type classes (`.label-l`, `.body-m`, …), `.brand`, `.btn`, `.chip` and `.mono` no longer exist.

## Dependencies

- AppLayout
- ThemeTokens
- BundledFont

## Requirements served

- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-2`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-3`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-4`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-7`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-9`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-10`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-11`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-12`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-32`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-46`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-47`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-52`
- `plan-claude_sessions_client/REQ-1`, `plan-claude_sessions_client-ui_redesign/REQ-1`
