---
module: app
component: WebEntry
type: UI entry point
---

# WebEntry

**Purpose** → the HTML page, the script that mounts the React app, and the global styles with the shared classes of the mock.

## Contract

- the page has `lang="en"` and the title "Vexel for Claude".
- `color-scheme` on `:root` follows the active theme: `light` when the root carries `data-theme="light"`, `dark` in Dark and Dark Blue. Scrollbars and native controls render in the active theme, whatever the system theme.
- before the first paint, an inline script in the head, before the styles, reads `localStorage` key `ai-client.theme` (ThemeStore `THEME_KEY`):
  - value `light`, `dark` or `dark-blue` → that theme. A valid saved theme always wins.
  - anything else, missing, or storage not reachable → `dark-blue`, the first-start theme.
  - effect: `data-theme` on the root carries that theme; the `color-scheme` meta is `light` for Light, `dark` for Dark and Dark Blue. The page never paints another theme first.
- the same script reads `localStorage` key `ai-client.look` (LookStore `LOOK_KEY`):
  - value `vexel` or `windows11` → that look.
  - anything else, missing, or storage not reachable → `vexel`.
  - effect: `data-look` on the root carries that look. The page never paints the other look first.
- the `color-scheme` meta is `dark` in the HTML file, so a first start shows no light flash. It only applies before the styles load: the `:root` value overrides it.
- the script renders AppLayout in `#root`, with the global styles. The global styles load ThemeTokens, then Windows11Look.
- body → `--bg-canvas` background, `--text-primary` text, Roboto Flex 14 px, line height 1.5.
- selected text → `--accent-selection` background.
- scrollbars → 5 px, transparent track, `--scrollbar-thumb` thumb with full rounding, `--scrollbar-thumb-hover` on hover. Browsers without `::-webkit-scrollbar` get `scrollbar-width: thin` in the thumb colour.
- the element with the keyboard focus, when focused from the keyboard, shows a 2 px `--accent-primary` ring 2 px away. A control at the edge of a list that scrolls shows the ring inside its own edge, so the list does not cut it. In Dark Blue, an active entry with an accent border (session entry, session card, ListStyles card or row) shows the ring 4 px inside its edge, so a gap keeps it apart from the border.
- buttons have no look of their own until a class gives one. A disabled button is dimmed to 55 % and shows the not-allowed cursor.
- `.icon` → 16 px, no fill, stroke in the text colour, width 2, round caps and joins.

Mock classes, the same as the `<style>` block of the mock:

| Class | Look |
|-------|------|
| `.vx-surface-1` / `-2` | `--role-chrome` / `--role-raised`, 1 px `--role-border-subtle` border, inset 1 px `--specular-top` line on top |
| `.vx-surface-3` | `--role-card-active`, 1 px `--role-border-strong` border |
| `.vx-glass` | `--bg-glass`, 14 px backdrop blur, 1 px `--border-strong` border, top line and `0 12px 32px -8px` black at 35 % |
| `.vx-popup-glass` | the popup glass: `--popup-glass-bg` background and a `--popup-glass-blur` backdrop blur, nothing else. Without backdrop blur the background stays at 60 % |
| `.vx-dot-grid` | 1 px dots in `--border-strong` every 18 px |
| `.kbd-badge` | mono 10 px, padding 1 × 5 px, `--radius-pill`, `--role-pill`, `--border-pill`, `--text-muted` |
| `.accent-pill` | `--radius-pill`, `--role-accent-glow` background, `--role-accent` text, `--role-accent-border` border |
| `.vx-pulse` | Tailwind `animate-pulse`: opacity to 0.5 and back every 2 s |

Client classes built from the mock's parts:

| Class | Look (mock source) |
|-------|-------------------|
| `.section-label` | mono 10 px, uppercase, letter spacing 0.05em, `--text-muted` ("Orchestrated Sessions") |
| `.section-label-path` | with `.section-label`: no uppercase, long text wraps |
| `.mono-chip` | mono 10 px, padding 2 × 6 px, the pill shape (`--radius-pill`, `--role-pill`, `--border-pill`), `--text-secondary`; used with `.vx-surface-2` (`#subbar-model`) |
| `.button-neutral` | 12/16 px, padding 6 × 12 px, `--radius-frame`, `--role-raised`, `--border-pill`, top line, `--text-primary`; hover → `--role-hover` and `--role-accent-border` border ("Cancel") |
| `.button-primary` | 12/16 px weight 500, padding 6 × 16 px, `--radius-frame`, `--role-accent` fill, `--on-accent` text, Tailwind `shadow` ("Start Session") |
| `.button-bar` | with `.button-primary`: 32 px high, padding 0 × 10 px, `shadow-sm`, scaled to 95 % while pressed (e.g. "Resume Here") |
| `.button-danger` | mono 11 px, padding 4 × 10 px, `--radius-pill`, rose-500 at 15 % fill, rose-400 text, rose-500 at 30 % border; hover → fill at 25 % (`#subbar-stop-btn`) |
| `.button-attn` | `.button-danger` in amber |
| `.button-interrupt` | `.button-danger` in orange: `--orange-500-15` fill, `--orange-400` text and icon, `--orange-500-30` border; hover → `--orange-500-25` fill. Keyboard focus shows the common focus ring. "Interrupt" of SessionView |
| `.field`, `.field-label`, `.field-input` | label mono 11 px `--text-secondary`, 4 px above the input. Input mono 12 px, padding 8 × 12 px, `--radius-frame`, `--field-bg`, 1 px `--field-border` border; on focus no outline: the border becomes `--role-accent` with a 1 px `--field-focus-ring` ring around it (`#new-sess-dir`; in Dark Blue the mock's prompt box) |

- the font is Roboto Mono wherever the mock uses JetBrains Mono, and Roboto Flex wherever it uses Plus Jakarta Sans or Instrument Serif. Where the mock asks mono 600 or 700, the client uses 500.
- with `prefers-reduced-motion: reduce`, the pulse, the spinner and the progress bar do not move, and the motion durations (MotionTokens) are 0 ms.

## Rules and invariants

- No style loads a file from another server. The Tailwind CDN and the Google fonts of the mock are not used.
- The Material 3 type classes (`.label-l`, `.body-m`, …), `.brand`, `.btn`, `.chip` and `.mono` no longer exist.

## Dependencies

- AppLayout
- ThemeTokens
- ThemeStore (takes over the first mark)
- LookStore (takes over the first look mark), Windows11Look
- BundledFont
- MotionTokens

## Requirements served

- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-2`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-3`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-4`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-7`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-9`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-10`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-11`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-12`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-32`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-46`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-47`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-52`
- `plan-claude_sessions_client/REQ-1`, `plan-claude_sessions_client-ui_redesign/REQ-1`
- `plan-light_theme/REQ-11`, `plan-light_theme/REQ-13`, `plan-light_theme/REQ-18`, `plan-light_theme/REQ-19`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-10`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-11`
- `plan-session_list_width/REQ-32`, `plan-session_list_width/REQ-34`, `plan-session_list_width/REQ-35`, `plan-session_list_width/REQ-36`
- `plan-wsl_support/REQ-17`, `plan-wsl_support/REQ-23`, `plan-wsl_support/REQ-24`, `plan-wsl_support/REQ-34`
- `plan-dark_blue_theme/REQ-1`, `plan-dark_blue_theme/REQ-3`, `plan-dark_blue_theme/REQ-4`
- `plan-dark_blue_theme/REQ-32`, `plan-dark_blue_theme/REQ-33`, `plan-dark_blue_theme/REQ-35`, `plan-dark_blue_theme/REQ-40`, `plan-dark_blue_theme/REQ-42`
- `plan-ui_transitions/REQ-25`, `plan-ui_transitions/REQ-30`
- `plan-popup_glass/REQ-1`, `plan-popup_glass/REQ-2`, `plan-popup_glass/REQ-5`, `plan-popup_glass/REQ-7`
