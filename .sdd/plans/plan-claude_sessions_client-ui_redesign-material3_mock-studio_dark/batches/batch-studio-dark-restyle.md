---
batch: studio-dark-restyle
feature: Dark "Studio" restyle (all features of the plan, one batch by human decision)
closed_req: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29, REQ-30, REQ-31, REQ-32, REQ-33, REQ-34, REQ-35, REQ-36, REQ-37, REQ-38, REQ-39, REQ-40, REQ-41, REQ-42, REQ-43, REQ-44, REQ-45, REQ-46, REQ-47, REQ-48, REQ-49, REQ-50, REQ-51, REQ-52, REQ-53]
depends: []
---

# Batch — Dark "Studio" restyle

The whole client takes the look of the default dark theme of the Studio mock, with a light-blue accent. Only the look changes. The batch holds every feature of the plan because the human asked for one batch.

The REQs are in `.sdd/plans/plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/requirements.md`. Its section "Constraints on the whole plan" applies to every INT below.

## Visual reference

Mock file → `.sdd/mockups/studio-dark/mock.html`. It is binding. Use only its default dark theme: the `:root` block of its `<style>`. Ignore `[data-theme="editorial-light"]` and `[data-theme="carbon-indigo"]`.

To the developer: open the mock file and copy the look of the matching element (sizes, radii, borders, spacing, type sizes and weights, colours, states); a description is not a substitute.

Where to read in the mock file:
- The custom classes (`.vx-surface-1/2/3`, `.vx-glass`, `.vx-dot-grid`, `.vx-rail-btn`, `.vx-tooltip`, `.vx-session-row`, `.kbd-badge`, `.accent-pill`, scrollbars) are in the `<style>` block in `<head>`.
- The page parts are HTML comments in capitals: "1. TOP APP BAR", "PRIMARY 52PX NAVIGATION RAIL", "COMPACT 220PX SESSIONS QUICK-SWITCHER SIDEBAR", "SCREEN 1: ACTIVE SESSION VIEW", "MODAL 1: NEW SESSION DIALOG", "Toast Notification".
- The session rows, the messages and the tool cards are built by the script: `renderSidebarQuickList()`, `selectSession()`. The status colours are in `statusMeta()`.
- The rest of the mock uses Tailwind classes. Their values are in the table "Tailwind values" below. Do not load Tailwind.

Do not copy:
- The mock's orange. The light-blue accent replaces it (see Decisions).
- The English texts. The current Italian texts stay.
- The extra features. These include the showcase bar, `#screen-compare`, `#screen-sessions` with its search and filters, the centre session pill, `#subbar-model`, `#permission-banner` buttons, the prompt composer, `#modal-settings`, the sidebar toggle, the rail settings button, the connection dot, the host footer and the ⌘ shortcuts. Some INTs copy only the look of one of these parts, and they say so.
- The `<script src="https://cdn.tailwindcss.com">` and the Google Fonts `<link>`.

The mock needs the network to render. Offline it looks broken, but its CSS stays readable in the file.

## What this batch builds

Every part copies `.sdd/mockups/studio-dark/mock.html`. To the developer: open the mock file and copy the look of the matching element (sizes, radii, borders, spacing, type sizes and weights, colours, states); a description is not a substitute.

New components:
- **Top bar** (INT-14, INT-15) → the 48 px bar above the page. It holds the logo, "Vexel for Claude" and the "Nuova sessione" button. Mock: the `<header class="h-12 …">` under "1. TOP APP BAR".
- **Area state block** (INT-12) → the shared block for empty, loading and error states that fill an area. Mock: `#orchestrator-empty-state`, without the serif font.

The batch also redraws every existing screen and dialog. That covers the rail, the list panel, the list rows, the session subbar, the terminal, the conversation, the snackbar and the dialogs.

## Decisions for this batch

- **One dark theme.** The light colour set and the `prefers-color-scheme` switch are removed. The client never reads the system theme.
- **Light blue.** `--accent-primary` takes the value of the current dark `--primary` in `src/web/theme/tokens.css`. Read it before INT-1 replaces the file. `--accent-secondary` is the same hue, lighter by the same CIELAB L* gap as `#f29a76` is from `#e06d44`. `--accent-deep` replaces `#9a3412` and `#b8431b`. It is the same hue, darker by the L* gap between `#e06d44` and `#9a3412`.
- **Text on the accent.** The mock puts white text on its orange. White on light blue fails 4.5:1, so the accent fill takes a dark `--on-accent` text. Use `--bg-canvas` when it reaches 4.5:1 (REQ-52). The logo letters use it too.
- **Status dots replace the state icons.** The mock shows a coloured dot, and the state name next to it keeps the state readable without colour. The project avatar leaves the list and the header.
- **Tool card icon.** The mock card has no tool icon, so the icon goes. The tool name chip identifies the tool.
- **Dialog icon.** The mock header has the accent dot in that place, so the dialog icon and the warning circle go. The amber warning keeps its triangle inside its banner (INT-53).
- **Subbar line.** The subbar keeps the text of the old header line. It shows the label of a hosted session, or "Aperta in un altro terminale" for an external one, as muted text cut with an ellipsis. It sits where the mock shows `#subbar-model`. Only the look of `#subbar-model` is reused, not the model.
- **Message avatars.** Claude → the accent square with "✦". User → the neutral square of the mock's user message, with "T" for "Tu" in place of the mock's "U".
- **"[Esc]".** It is a button. Its accessible name is "Chiudi (Esc)", so it does not clash with "Annulla". It sits in the dialog focus trap.
- **Path headings.** In the resume history the folder path headings use the mono label style without uppercase, because uppercase would change the path.
- **Area states** (REQ-50). These use the block of INT-12: the main-area empty state, the loading, empty and error states of the session list, of the conversation and of the resume history. Errors under a field, next to a button or in a tool card stay inline, in rose.
- **Dialog avatars.** The rows of the dialogs keep their project avatar, redrawn as the mock's neutral 24 px square. It has no colour per project.
- **Mono weights.** The bundled Roboto Mono has weights 400 and 500. Where the mock asks mono 600 or 700, use 500. Nothing is downloaded.
- **Motion.** With `prefers-reduced-motion: reduce` the pulse stops, as the spinner already does.
- **Tooltips** show on hover, as in the mock. The accessible names of the rail buttons stay.
- **Snackbar.** It is fixed at the bottom right of the window and can cover the corner of the terminal. The terminal panel does not resize for it.
- **Old names.** The Material 3 colour roles, the `--color-*` names and the board classes (`.brand`, type scale, `.btn`, `.chip`) are removed once no component uses them. Until then they point to the mock tokens (INT-5).

## Tailwind values

The mock's Tailwind classes resolve to these standard Tailwind v3 values.

| Class | Value |
|-------|-------|
| spacing unit (`p-1`, `h-1`, `gap-1`) | 4 px. `h-12` = 48, `h-10` = 40, `h-8` = 32, `w-7` = 28, `w-6` = 24, `p-2.5` = 10 |
| `text-xs` / `text-sm` / `text-2xl` | 12/16 px / 14/20 px / 24/32 px |
| `rounded` / `-md` / `-lg` / `-xl` / `-full` | 4 / 6 / 8 / 12 px / 9999 px |
| `font-medium` / `-semibold` / `-bold` | 500 / 600 / 700 |
| `tracking-tight` / `-wider` / `-widest` | −0.025em / 0.05em / 0.1em |
| emerald-400 / 500 | `#34d399` / `#10b981` |
| amber-300 / 400 / 500 | `#fcd34d` / `#fbbf24` / `#f59e0b` |
| rose-300 / 400 / 500 | `#fda4af` / `#fb7185` / `#f43f5e` |
| zinc-400 / 500 | `#a1a1aa` / `#71717a` |
| `/15`, `/30`, `/40`, `/65` after a colour | that colour at 15 %, 30 %, 40 %, 65 % opacity |
| `animate-pulse` | `pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite`, keyframe `50% { opacity: .5 }` |
| `backdrop-blur-sm` | not used: the dialog backdrop has no blur (INT-48) |
| `shadow-sm` | `0 1px 2px 0 rgb(0 0 0 / .05)` |
| `shadow-lg` | `0 10px 15px -3px rgb(0 0 0 / .1), 0 4px 6px -4px rgb(0 0 0 / .1)` |
| `shadow-2xl` | `0 25px 50px -12px rgb(0 0 0 / .25)` |

## Interventions

Each row names the mock element to copy. For each UI row: open the mock file and copy the look of the matching element (sizes, radii, borders, spacing, type sizes and weights, colours, states); a description is not a substitute.

### Theme and global styles

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/theme/tokens.css` | `.sdd/mockups/studio-dark/mock.html` → `:root` block. One dark set on `:root` with its names and values: `--bg-*`, `--border-*`, `--specular-top`, `--text-*`, `--term-size`. Remove the light set and the `prefers-color-scheme` switch. | REQ-1, REQ-4 | — |
| INT-2 | modify | `src/web/theme/tokens.css` | `.sdd/mockups/studio-dark/mock.html` → `--accent-*` in `:root`. Accent family as in Decisions: `--accent-primary`, `--accent-secondary`, `--accent-glow` (16 %), `--accent-border` (42 %), `--accent-deep`, `--on-accent` (4.5:1 on the accent). | REQ-5, REQ-6, REQ-52 | INT-1 |
| INT-3 | modify | `src/web/theme/tokens.css` | `.sdd/mockups/studio-dark/mock.html` → `statusMeta()`. Status tokens: emerald, amber, rose, zinc, each solid and tinted at the opacities the mock uses. Values in the Tailwind table. | REQ-8 | INT-1 |
| INT-4 | modify | `src/web/theme/tokens.css` | `.sdd/mockups/studio-dark/mock.html` → `--text-muted` (`#686773`). Make `--text-muted` lighter, and any other text colour that fails, only until it reaches 4.5:1 on canvas and surfaces 1, 2 and 3. | REQ-51 | INT-1 |
| INT-5 | modify | `src/web/theme/tokens.css` | `.sdd/mockups/studio-dark/mock.html` → `:root` block. The Material 3 roles and the `--color-*` names point to the nearest mock token until no component uses them. `--color-error` → rose-400. `--term-bg` → canvas, `--term-fg` → `--text-primary`. `--color-backdrop` → black at 65 %. | REQ-4 | INT-1, INT-2, INT-3 |
| INT-6 | modify | `src/web/index.html`, `src/web/styles.css` (WebEntry) | `.sdd/mockups/studio-dark/mock.html` → `<html class="dark">`. Declare `color-scheme: dark` only, in the page meta and on `:root`. Scrollbars and form controls then render dark. | REQ-1, REQ-2 | INT-1 |
| INT-7 | modify | `src/web/styles.css` | `.sdd/mockups/studio-dark/mock.html` → `<style>` → `body`, `::-webkit-scrollbar*`, `selection:bg-orange-500/30`. Body on canvas in Roboto Flex; `--font-mono` = Roboto Mono. Selection = accent at 30 %. Scrollbars as the mock, plus `scrollbar-width: thin`. | REQ-2, REQ-3, REQ-7, REQ-10, REQ-11 | INT-2, INT-6 |
| INT-8 | modify | `src/web/styles.css` | `.sdd/mockups/studio-dark/mock.html` → `<style>` → add `.vx-surface-1/2/3`, `.vx-glass`, `.vx-dot-grid`, `.kbd-badge` and `.accent-pill`, the same as in the mock. Add the pulse animation of `animate-pulse`, which stops under reduced motion. | REQ-4, REQ-9 | INT-1, INT-2 |
| INT-9 | modify | `src/web/styles.css` | `.sdd/mockups/studio-dark/mock.html` → "MODAL 1" footer buttons and `#subbar-stop-btn`. Button classes: neutral ("Cancel"), accent ("Start Session", with `--on-accent` text), rose (`#subbar-stop-btn`), amber (the rose button's shape in amber). Disabled looks dimmed. Focus ring in the accent. | REQ-32, REQ-47, REQ-52 | INT-2, INT-3 |
| INT-10 | modify | `src/web/styles.css` | `.sdd/mockups/studio-dark/mock.html` → "Orchestrated Sessions" `<span>` in "COMPACT 220PX SESSIONS QUICK-SWITCHER SIDEBAR". A section-label class: 10 px Roboto Mono, uppercase, `tracking-wider`, `--text-muted`. | REQ-12 | INT-7 |
| INT-11 | modify | `src/web/styles.css` | `.sdd/mockups/studio-dark/mock.html` → `#new-sess-dir` and its `<label>`. A field class: label 11 px mono in `--text-secondary`. Input on canvas with the subtle border, and the accent border on focus. | REQ-46 | INT-7 |

### Area states

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-12 | create | app module, feedback area | `.sdd/mockups/studio-dark/mock.html` → `#orchestrator-empty-state`. Surface 1 block, 48 px icon tile (accent; rose on error), Roboto Flex title, 12 px secondary text, optional actions. Full and compact sizes. Keeps the state's role and exact text. | REQ-50 | INT-8 |
| INT-13 | modify | `src/web/EmptyState.tsx` | `.sdd/mockups/studio-dark/mock.html` → `#orchestrator-empty-state`. Draw it with the block of INT-12: the terminal icon, its two current texts, "Nuova sessione" as the accent button and "Riprendi sessione" as the neutral one. | REQ-50 | INT-9, INT-12 |

### Page frame

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-14 | create | app module, page frame (next to NavigationRail) | `.sdd/mockups/studio-dark/mock.html` → "1. TOP APP BAR" `<header class="h-12 …">`. 48 px top bar on surface 2 with a subtle bottom border. On the left the logo, then "Vexel" and "for Claude" in the brand styles. On the right "Nuova sessione" in the look of the mock's "New Session" button. No other control. | REQ-14, REQ-53 | INT-8, INT-9 |
| INT-15 | create | app module, page frame (inside the top bar) | `.sdd/mockups/studio-dark/mock.html` → the 28 px "VX" square in "1. TOP APP BAR". Logo mark: 8 px radius, gradient from `--accent-primary` to `--accent-deep`, mono bold "VX" in `--on-accent`. | REQ-16, REQ-6 | INT-14 |
| INT-16 | modify | `src/web/AppLayout.tsx` | `.sdd/mockups/studio-dark/mock.html` → "MAIN VEXEL APPLICATION SHELL", but without the outer margin and the rounded frame. Top bar above, then rail, list panel and main area, filling the window. "Nuova sessione" in the top bar opens FolderChooser, as the rail does. | REQ-13, REQ-14, REQ-15 | INT-14 |
| INT-17 | modify | `src/web/AppLayout.tsx` | `.sdd/mockups/studio-dark/mock.html` → `#quick-session-list` and its header row. List panel 224 px on surface 1, subtle right border, 10 px padding. Remove the brand row. The `h1` "Sessioni" takes the INT-10 label style, and the counter sits where the mock has "View all →". | REQ-12, REQ-14, REQ-21, REQ-53 | INT-10 |
| INT-18 | modify | `src/web/AppLayout.tsx` | `.sdd/mockups/studio-dark/mock.html` → "3. MAIN CONTENT STAGE" (`.vx-dot-grid`) and `#screen-session` (canvas at 75 %). The main area shows the dot grid. The snackbar is always fixed at the bottom right of the window, 20 px from the edges (`#toast-pill`). It is never in the hint row. | REQ-22, REQ-42 | INT-8 |
| INT-19 | modify | `src/web/NavigationRail.tsx` | `.sdd/mockups/studio-dark/mock.html` → `#primary-rail`, top group only. 52 px rail, no logo. "Nuova sessione" as `.vx-rail-fab` (gradient to `--accent-deep`, `--on-accent` icon), the divider, then "Sessioni" and "Riprendi" as `.vx-rail-btn`, no labels. | REQ-6, REQ-14, REQ-17, REQ-53 | INT-2, INT-8 |
| INT-20 | modify | `src/web/NavigationRail.tsx` | `.sdd/mockups/studio-dark/mock.html` → `.vx-rail-btn.active`, `.vx-rail-btn.active::before` and `.vx-tooltip`. "Sessioni" always has the active style. Each button shows a `.vx-tooltip` with its Italian name on hover, and no shortcut. The accessible names do not change. | REQ-18, REQ-19 | INT-19 |
| INT-21 | modify | `src/web/NavigationRail.tsx` | `.sdd/mockups/studio-dark/mock.html` → parts (no counterpart): `.vx-rail-btn` corner, amber of `statusMeta()`. The "Sessioni" badge becomes a small amber-400 pill with the number in mono 10 px, in canvas colour, on the top right corner of the button. It is still hidden at zero. | REQ-20 | INT-3, INT-19 |
| INT-22 | modify | `src/web/NeedsInputSnackbar.tsx` | `.sdd/mockups/studio-dark/mock.html` → `#toast-pill` (`.vx-glass`). Glass box with 8 px radius and 12 px mono text, and the folder name in bold. "Apri" is a text button in the accent colour. | REQ-41 | INT-8 |

### Session list

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-23 | modify | `src/web/sessions/StateBadge.tsx` | `.sdd/mockups/studio-dark/mock.html` → `statusMeta()` and `#subbar-status-badge`. The dot replaces the icon, in the REQ-8 colours, and pulses for working and needs input. Variants: `dot` alone, `inline` (dot plus mono name), `chip` (the tinted mono pill of `#subbar-status-badge`). | REQ-8, REQ-9, REQ-11, REQ-31 | INT-3, INT-8 |
| INT-24 | modify | `src/web/sessions/SessionList.tsx` | `.sdd/mockups/studio-dark/mock.html` → `.vx-session-row`, as built in `renderSidebarQuickList()`. Each row has the status dot in place of the Avatar, the folder name, and the mono state and time on the right, then the label line. The row is taller than 30 px only for that content. | REQ-11, REQ-23, REQ-25 | INT-8, INT-23 |
| INT-25 | modify | `src/web/sessions/SessionList.tsx` | `.sdd/mockups/studio-dark/mock.html` → `.vx-session-row.active`. The open entry gets the accent glow and the 2 px accent bar. An ended entry stays dimmed, with muted text. An external entry keeps its dashed border, also when it is open. | REQ-24, REQ-27, REQ-29 | INT-24 |
| INT-26 | modify | `src/web/sessions/SessionList.tsx` | `.sdd/mockups/studio-dark/mock.html` → `#permission-banner`, look only. The card takes the banner frame. "Richiede input" takes the "Permission Required" tag, the needs-input line the `#perm-cmd` look, "Rispondi" the "Approve & Run" button without "↵". | REQ-28 | INT-9, INT-24 |
| INT-27 | modify | `src/web/sessions/SessionList.tsx` | `.sdd/mockups/studio-dark/mock.html` → `.vx-session-row` and `#subbar-model`, look only. An external needs-input entry is a dashed row with the amber dot. "Esterna" is a neutral mono chip. "Permesso per <tool>" is in amber mono. It has no "Rispondi". | REQ-27, REQ-28 | INT-25 |
| INT-28 | modify | `src/web/sessions/SessionList.tsx` | `.sdd/mockups/studio-dark/mock.html` → "Orchestrated Sessions" label. Group headings take the INT-10 class, all muted. Loading, "Nessuna sessione." and the connection error use the compact block of INT-12. | REQ-12, REQ-50 | INT-10, INT-12 |
| INT-29 | modify | `src/web/sessions/ProgressBar.tsx` | `.sdd/mockups/studio-dark/mock.html` → `statusMeta()` running colour. The track is emerald-500 at 15 % and the indicator is emerald-400. The motion does not change. | REQ-26 | INT-3 |
| INT-30 | modify | `src/web/sessions/NeedsInputCounter.tsx` | `.sdd/mockups/studio-dark/mock.html` → `#subbar-status-badge`, amber variant. The chip "N richiede input" becomes the amber tinted mono pill, with the pulsing amber dot in place of the icon. It is still hidden at zero. | REQ-21 | INT-23 |
| INT-31 | modify | `src/web/sessions/Avatar.tsx` | `.sdd/mockups/studio-dark/mock.html` → user avatar in `selectSession()` (the 24 px "U" square). Redraw the `dialog` size as that neutral square with mono initials and no colour per project. Remove the `list` and `header` sizes and the external variant once they are unused. | REQ-4 | INT-1 |

### Session view

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-32 | modify | `src/web/sessions/SessionHeader.tsx` | `.sdd/mockups/studio-dark/mock.html` → "Session Info Subbar": `#subbar-title`, "/", `#subbar-dir`, `#subbar-status-badge`, actions. 40 px, no Avatar. The line text sits where `#subbar-model` is (Decisions). Texts cut with ellipsis and tooltip; actions never cut. | REQ-11, REQ-30, REQ-53 | INT-23 |
| INT-33 | modify | `src/web/sessions/SessionView.tsx` | `.sdd/mockups/studio-dark/mock.html` → `#subbar-stop-btn`. "Interrompi" takes the rose class of INT-9, with the "■" glyph in place of its icon. | REQ-32 | INT-9 |
| INT-34 | modify | `src/web/sessions/StopSessionButton.tsx` | `.sdd/mockups/studio-dark/mock.html` → `#subbar-stop-btn`. "Termina" takes the rose class with "■". The Spinner replaces "■" while busy. The error message is rose. | REQ-32 | INT-9 |
| INT-35 | modify | `src/web/sessions/SessionView.tsx` | `.sdd/mockups/studio-dark/mock.html` → tool card frame in `selectSession()` (`rounded-lg`, `--border-subtle`) and `<pre class="term-output">` (canvas). The terminal panel is on canvas, with an 8 px radius and the subtle border. The focus ring is kept. | REQ-34 | INT-5 |
| INT-36 | modify | `src/web/sessions/SessionView.tsx` | `.sdd/mockups/studio-dark/mock.html` → `--term-size` and `.term-output`. xterm uses Roboto Mono at 12 px, background canvas, text `--text-primary`, cursor accent and selection accent at 30 %. The ANSI colours do not change. | REQ-7, REQ-11, REQ-34 | INT-2, INT-5 |
| INT-37 | modify | `src/web/sessions/SessionView.tsx` | `.sdd/mockups/studio-dark/mock.html` → `.kbd-badge`. The keys "Ctrl", "Maiusc", "L" are `.kbd-badge`, and the hint text is 11 px muted. Remove the snackbar slot (INT-18). The row height stays fixed. | REQ-35, REQ-42 | INT-8, INT-18 |
| INT-38 | modify | `src/web/external/ConversationView.tsx` | `.sdd/mockups/studio-dark/mock.html` → `#session-stream`. No rounded panel. The content sits on canvas at 75 % over the dot grid, in a centred column of at most 896 px with 24 px padding and entries 16 px apart. | REQ-22 | INT-18 |
| INT-39 | modify | `src/web/external/ConversationView.tsx` | `.sdd/mockups/studio-dark/mock.html` → `#subbar-model`, look only. "Sola lettura" is a neutral mono chip on surface 2 and keeps its lock icon at 12 px. | REQ-33 | INT-32 |
| INT-40 | modify | `src/web/external/ConversationView.tsx` | `.sdd/mockups/studio-dark/mock.html` → user and assistant blocks in `selectSession()`. Each message has a 24 px square avatar, a name line ("Tu" or "Claude", 12 px semibold, mono 10 px muted time), then the text. User messages are left-aligned, with the text in a `.vx-surface-2` box. | REQ-11, REQ-36, REQ-37 | INT-8 |
| INT-41 | modify | `src/web/external/ConversationView.tsx` | `.sdd/mockups/studio-dark/mock.html` → assistant avatar ("✦" on `--accent-primary`) and user avatar ("U" square). Claude gets the accent square with "✦" in `--on-accent`. The user gets the neutral square with "T". The ember spark goes. | REQ-36, REQ-38 | INT-40 |
| INT-42 | modify | `src/web/external/ConversationView.tsx` | `.sdd/mockups/studio-dark/mock.html` → tool card in `selectSession()`. Card aligned with the message text. Row: accent name chip, mono target, outcome in mono ("Fatto" emerald-400, "Fallito" rose-400) followed by "▾". No tool icon. | REQ-8, REQ-11, REQ-39 | INT-3, INT-40 |
| INT-43 | modify | `src/web/external/ConversationView.tsx` | `.sdd/mockups/studio-dark/mock.html` → `<pre class="term-output">` of the tool card. The open block is on canvas with a subtle top border, mono 12 px, `--text-secondary`. A closed card shows "▾" turned to the right. | REQ-39 | INT-42 |
| INT-44 | modify | `src/web/external/ConversationView.tsx` | `.sdd/mockups/studio-dark/mock.html` → `#subbar-model`, look only. Inline code is a mono chip: 4 px radius, surface 2, subtle border. | REQ-40 | INT-8 |
| INT-45 | modify | `src/web/external/ConversationView.tsx` | `.sdd/mockups/studio-dark/mock.html` → `#toast-pill` (`.vx-glass`). "N nuovi messaggi" becomes a glass button with 8 px radius and 12 px mono text. Its place and behaviour do not change. | REQ-41 | INT-8 |
| INT-46 | modify | `src/web/external/ConversationView.tsx` | `.sdd/mockups/studio-dark/mock.html` → `#orchestrator-empty-state`. Loading, "Nessun messaggio." and "Conversazione non disponibile." use the block of INT-12. | REQ-50 | INT-12 |
| INT-47 | modify | `src/web/external/ResumeHereButton.tsx` | `.sdd/mockups/studio-dark/mock.html` → top-bar "New Session" button. "Riprendi qui" is an accent button (32 px high, 8 px radius, 12 px medium, `--on-accent` text) with the log-in icon at 14 px. | REQ-33, REQ-52 | INT-9 |

### Dialogs

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-48 | modify | `src/web/dialogs/Dialog.tsx` | `.sdd/mockups/studio-dark/mock.html` → `#modal-new-session`. Backdrop black at 65 %, with no backdrop blur (human decision 2026-11-06: scroll performance). Frame `.vx-surface-2` with the strong border, 12 px radius, `shadow-2xl`, at most 448 px wide. Header, body and footer sections. No icon. | REQ-43 | INT-5, INT-8 |
| INT-49 | modify | `src/web/dialogs/Dialog.tsx` | `.sdd/mockups/studio-dark/mock.html` → `#modal-new-session` header. Accent dot (8 px), title 14 px semibold, and on the right "[Esc]" in mono 12 px muted, primary on hover. | REQ-44 | INT-48 |
| INT-50 | modify | `src/web/dialogs/Dialog.tsx` | `.sdd/mockups/studio-dark/mock.html` → `[Esc]` button of `#modal-new-session`. A click on "[Esc]" calls `onCancel()`, as "Annulla" does. Its accessible name is "Chiudi (Esc)", and it is part of the focus trap. | REQ-45 | INT-49 |
| INT-51 | modify | `src/web/dialogs/Dialog.tsx` | `.sdd/mockups/studio-dark/mock.html` → `#modal-new-session` footer. Surface 1 with a subtle top border, aligned right. "Annulla" takes the neutral class and the primary action the accent class. Busy and disabled do not change. | REQ-47, REQ-52 | INT-9, INT-48 |
| INT-52 | modify | `src/web/dialogs/Dialog.tsx` | `.sdd/mockups/studio-dark/mock.html` → `#modal-new-session` body (`p-4`, `text-xs`). The description is 12 px `--text-secondary`, at the top of the body. | REQ-43 | INT-48 |
| INT-53 | modify | `src/web/dialogs/WarningDialog.tsx` | `.sdd/mockups/studio-dark/mock.html` → `#subbar-stop-btn` and `#permission-banner`, look only. No icon circle. `error` → the primary action takes the rose class. `attn` → the text sits in a banner with an amber-500/40 border and an amber triangle, and the primary action takes the amber class. | REQ-48, REQ-49 | INT-9, INT-48 |
| INT-54 | modify | `src/web/folders/FolderChooser.tsx` | `.sdd/mockups/studio-dark/mock.html` → `#new-sess-dir` and its label. "Cartella del progetto" takes the field class of INT-11, with the label above and a mono input. The folder icon inside the field goes. | REQ-46 | INT-11, INT-52 |
| INT-55 | modify | `src/web/folders/FolderChooser.tsx` | `.sdd/mockups/studio-dark/mock.html` → `.vx-session-row` and `.vx-session-row.active`. "Recenti" and "Cartelle" take the INT-10 label. Rows have two lines (name 12 px, path in mono 11 px muted). Surface 2 on hover; checked = active row. Folder entries show the folder icon in a 24 px surface-3 square. | REQ-12 | INT-10, INT-31 |
| INT-56 | modify | `src/web/history/ResumeDialog.tsx` | `.sdd/mockups/studio-dark/mock.html` → as INT-55, plus `#subbar-status-badge` amber. Rows and headings as INT-55; path headings not uppercase. "In esecuzione in un terminale" → amber mono pill. Loading and empty list → compact block of INT-12. | REQ-8, REQ-12, REQ-50 | INT-12, INT-55 |

## Human acceptance

### Scenario: The user sees the client in the dark Studio look with a light-blue accent

- REQ → REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-10, REQ-13, REQ-14, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-51, REQ-52, REQ-53
- Given → the operating system uses the light theme, the window is 1440 x 900 px, and one session needs input
- When → the user opens the client and moves the pointer over "Riprendi" in the rail
- Then → the page is near-black edge to edge, with a 48 px top bar holding the light-blue "VX" mark, "Vexel for Claude" and "Nuova sessione", a 52 px rail with a small amber "1" on "Sessioni", a 224 px list headed "SESSIONI" with "1 richiede input", and a dot grid in the main area
- And → a tooltip "Riprendi" appears next to the button, and the scrollbars are thin and dark

### Scenario: The list shows each session as a compact Studio row

- REQ → REQ-8, REQ-9, REQ-11, REQ-12, REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29
- Given → the list holds one working, one idle, one ended, one external and one needs-input session
- When → the user clicks the working session
- Then → its row gets the light-blue glow and left bar, its emerald dot pulses above an emerald progress bar, and the ended row is dimmed
- And → the needs-input session is a card with an amber border, an amber "RICHIEDE INPUT" tag and a light-blue "Rispondi", and the external row has a dashed border

### Scenario: The open hosted session uses the Studio subbar and terminal

- REQ → REQ-30, REQ-31, REQ-32, REQ-34, REQ-35, REQ-42
- Given → a hosted session is open and working, and another session is not open
- When → the other session starts to need input
- Then → the snackbar appears at the bottom right of the window
- And → the 40 px subbar shows the folder name, "/", the path, an emerald "Lavora" pill and rose "Interrompi" and "Termina" buttons, above a 12 px terminal on the near-black canvas with "Ctrl", "Maiusc", "L" in key badges

### Scenario: The external session shows messages and tool cards in the Studio style

- REQ → REQ-33, REQ-36, REQ-37, REQ-38, REQ-39, REQ-40, REQ-41
- Given → an external session with a user message, a Claude reply with inline code, and a failed tool call is open
- When → the user opens the tool card
- Then → the card shows the tool name in a light-blue chip, the target in mono, "Fallito ▾" in rose, and the output on the canvas colour
- And → the messages are left-aligned with 24 px square avatars, "Tu" and "Claude" with mono times, the user text in a grey box and "✦" in a light-blue square

### Scenario: The new-session dialog uses the Studio modal

- REQ → REQ-15, REQ-43, REQ-44, REQ-45, REQ-46, REQ-47
- Given → no dialog is open
- When → the user clicks "Nuova sessione" in the top bar
- Then → the new-session dialog opens over a darkened page with no blur, with a light-blue dot, the title, "[Esc]", the mono label "Cartella del progetto", and a footer with a grey "Annulla" and a light-blue "Avvia sessione"
- And → a click on "[Esc]" closes the dialog and the open session does not change
- And → with sessions running behind it, the "Riprendi sessione" dialog list scrolls smoothly

### Scenario: The stop confirmation is drawn in rose

- REQ → REQ-48
- Given → a working hosted session is open
- When → the user clicks "Termina"
- Then → the confirmation shows its main action "Termina" in rose
- And → "Annulla" has the focus

### Scenario: The running-elsewhere warning is drawn in amber

- REQ → REQ-49
- Given → an external session is open
- When → the user clicks "Riprendi qui"
- Then → the warning shows its text in an amber banner, with "Riprendi comunque" in amber

### Scenario: The user sees the error state when the server stops

- REQ → REQ-50
- Given → no session is open, and the main area shows the empty state with the terminal tile, "Nessuna sessione aperta.", "Nuova sessione" and "Riprendi sessione"
- When → the server stops
- Then → the list shows "Connessione al server persa. Ricarica la pagina." in the empty-state layout, with a rose icon tile
