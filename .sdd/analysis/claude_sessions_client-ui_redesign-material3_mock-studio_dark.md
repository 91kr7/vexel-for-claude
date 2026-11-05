---
request_slug: claude_sessions_client-ui_redesign-material3_mock-studio_dark
date: 2026-11-06
type: evolution
size: ordinary
reference: .sdd/analysis/claude_sessions_client-ui_redesign-material3_mock.md
---

# Analysis — Dark "Studio" restyle of the client

## Request

> sei in grado di allinearmi lo stile a quello di questo mock? solo tema scuro? ~/Downloads/mock.html le feature in più che questo mock implementa lasciale perdere

## Reference

[claude_sessions_client-ui_redesign-material3_mock.md](claude_sessions_client-ui_redesign-material3_mock.md) → a restyle of every screen and dialog to the "Vexel for Claude" Material 3 boards, in light and dark theme, with a light-blue and grey palette. It added the rail, the list groups, the needs-input card, the snackbar, "Interrompi", "Recenti" and "N nuovi messaggi". It is merged into main.

Changes:
- The visual reference becomes `.sdd/mockups/studio-dark/mock.html`, default dark theme only.
- `.sdd/mockups/vexel-material3/` stops being the visual reference. It still says which elements exist and what they show.
- The client is always dark. The light theme goes away. The operating-system setting is ignored.
- The proportions become compact: a 48 px top bar, a 52 px rail with 34 px buttons, a 224 px list panel.
- The accent is light blue. The mock's orange and the reference's ember colour are not used.
- The logo and the brand move to the new top bar.
- The mock's status dot replaces the project avatar in the list.
- User messages become left-aligned, as in the mock.
- No behaviour changes. Every other requirement of the reference stays true.

## Summary

Restyle the client to the default dark theme of the "Studio" mock: compact desktop proportions, near-black surfaces, a light-blue accent. Only the look changes. The mock's extra features are not built.

## Requirements

### Functional

Visual reference
- The default dark theme of `.sdd/mockups/studio-dark/mock.html` (the `:root` values) must be the binding visual reference.
- Each existing element must take the look of the mock element with the same role: sizes, radii, borders, spacing, type sizes and weights, colours, hover, focus and active states.
- An existing element with no counterpart in the mock must be built from the mock's parts: surfaces, borders, chips, buttons, mono labels.
- UI texts must stay the current Italian ones. The mock's English texts are not used.

Theme and palette
- The client must always use the dark theme, whatever the operating-system setting.
- The light theme must be removed.
- Native parts of the page, such as scrollbars and form controls, must render dark.
- Scrollbars must be the mock's thin rounded ones.
- Canvas, surfaces, borders, the top highlight of surfaces and the text colours must use the mock's `:root` values.
- The accent must be light blue wherever the mock uses `--accent-primary`, `--accent-secondary`, `--accent-glow` or `--accent-border`.
- The accent glow and accent border must keep the mock's opacity: 16 % and 42 %.
- The dark end of the mock's accent gradients (`#9a3412`, `#b8431b`) must become a darker tone of the same blue.
- Text selection must use the accent at 30 % opacity.
- Status colours must follow the mock: emerald for "Lavora", amber for "Richiede input", rose for errors and "Fallito", zinc for "In attesa" and "Terminata".
- The dots of "Lavora" and "Richiede input" must pulse, as in the mock.

Typography
- The UI must use Roboto Flex where the mock uses Plus Jakarta Sans or Instrument Serif.
- The UI must use Roboto Mono where the mock uses JetBrains Mono: paths, times, chips, labels, tool names, code, the terminal.
- Group titles and section labels must be small mono uppercase labels in the muted colour, like the mock's "Orchestrated Sessions".

Page frame
- The client must fill the whole window. The mock's outer margin and rounded frame belong to the showcase.
- A 48 px top bar must show the logo and "Vexel for Claude" on the left, and an accent "Nuova sessione" button on the right.
- The logo must be the mock's square mark with the accent gradient.
- A 52 px rail must show the accent "Nuova sessione" button, a divider, then "Sessioni" and "Riprendi" as icon buttons, all 34 x 34 px.
- A rail button must show its name in a tooltip on hover, not as a label under it.
- The active destination must use the mock's active style: accent glow, accent border, and the 2.5 px bar on the left.
- The badge on "Sessioni" must stay, small and amber, on the corner of its button.
- The list panel must show the title "Sessioni" and the chip "N richiede input" in the mock's list header style.
- The main area must show the mock's dot-grid background.

Session list
- Each entry must use the mock's session row: status dot, folder name, mono details on the right, 6 px radius, surface 2 on hover.
- The open entry must use the mock's active row: accent glow and a 2 px accent bar on the left.
- An entry must keep its current content, and grow beyond the mock's 30 px only by the lines that content needs.
- The progress bar of a working entry must stay, in emerald.
- An external entry must keep its dashed border.
- The needs-input card must look like the mock's permission banner: surface 2, amber border, amber tag. Its "Rispondi" is an accent button.
- An ended entry must stay dimmed.

Session view
- The session header must be the mock's 40 px subbar: folder name, "/", mono path, state badge, then the actions on the right.
- The state badge must be the mock's tinted mono pill with its dot.
- "Interrompi" and "Termina" must use the mock's rose stop button.
- "Riprendi qui" must be an accent button. "Sola lettura" must be a neutral mono chip.
- The terminal must sit on the canvas colour, in a panel with the mock's subtle border, with 12 px mono text.
- The hint under the terminal must show its key in the mock's keyboard badge.
- Each message must follow the mock: a 24 px square avatar, a name line with a mono time, then the text.
- User text must sit in a surface-2 box. The Claude avatar must be the accent square with "✦".
- Each tool call must be the mock's tool card: tool name chip in accent, target in mono, outcome in coloured mono text with "▾", output on the canvas colour.
- Inline code must be a mono chip.
- The snackbar and the "N nuovi messaggi" button must use the mock's glass toast. The snackbar sits at the bottom right of the window.

Dialogs
- Every dialog must use the mock's modal: black backdrop at 65 % with blur, surface 2, strong border, 12 px radius, then header, body and footer.
- The header must show the accent dot, the title, and a mono "[Esc]" control that closes the dialog like "Annulla".
- Field labels must be 11 px mono. Fields sit on the canvas colour and take the accent border on focus.
- The footer must sit on surface 1, with "Annulla" as a neutral button and the main action as an accent button.
- The main action of the stop confirmation must use the rose style. The running-elsewhere warning must use amber, in the style of the permission banner.
- Empty, loading and error states must use the layout of the mock's empty state, without the serif font.

### Non-functional

- At 1440 x 900 px the frame must measure: top bar 48 px high, rail 52 px wide, rail buttons 34 x 34 px, list panel 224 px wide, session subbar 40 px high.
- Text must meet WCAG 2.2 AA contrast. Where a mock value fails, the text colour gets lighter only as much as needed.
- The mock's muted text `#686773` on surface 1 gives about 3.4:1, so it is one of these cases.
- Text on an accent-filled button must reach 4.5:1 against the light blue.
- Keyboard use with visible focus, the 1280 px minimum width, and about one second to open a session stay as in the reference.

## Assumptions

- This is an evolution, not a fix. The human said the restyle builds on the merged Material 3 work.
- The light blue is the primary colour that the current dark theme already uses. This keeps continuity with the reference.
- Surfaces keep the mock's exact values, because the human changed only the accent.
- Tailwind colour names in the mock (`emerald-400`, `amber-400`, `rose-400`, `zinc-400` and their tinted variants) mean Tailwind's standard values.
- "In attesa" matches the mock's idle state, so it takes zinc.
- The top bar holds only the brand and "Nuova sessione". The mock's centre session pill repeats the subbar, and its search and settings are extra features.
- The project avatar and its per-project colour go away from the list and the header. The mock shows a status dot there.
- The message name lines read "Tu" and "Claude".
- The terminal keeps its ANSI colours. Only its background, text, cursor and selection follow the mock.
- Hover transitions and the pulse use the mock's timings.

## Constraints

- Every later phase must cite `.sdd/mockups/studio-dark/mock.html` as the visual reference and pass it on.
- The developer must open the mock file and read its values. A description of the mock does not replace it.
- The mock file must be committed unchanged and stay in the repository.
- The client must ship its own Roboto Flex and Roboto Mono and contact no outside server. The mock's Tailwind CDN and Google Fonts links must not be copied.
- The work is delivered in a single batch, by the human's decision.
- The restyle must not remove any feature of the reference, nor any terminal feature of hosted sessions.

## Risks

- The mock needs the network to render, because of the Tailwind CDN and Google Fonts. Opened offline it looks broken, but its CSS stays readable.
- The compact sizes (10–11 px text, 34 px buttons) can make the client harder to read.
- Real content (long folder names, labels, needs-input lines) does not fit the mock's 30 px rows.
- A restyle on top of a fresh one can break behaviour: live updates, needs-input order, "Riprendi qui", the key that leaves the terminal.
- 12 px terminal text changes the number of rows and columns of hosted sessions.

## Scope

In scope:
- The restyle of every screen, dialog and state to the mock's default dark theme, with a light-blue accent.
- The removal of the light theme.
- The top bar and the compact rail described above.

Out of scope (extra features of the mock):
- The showcase bar, the "Before / After Sidebar Audit" screen, the sidebar modes.
- The "editorial-light" and "carbon-indigo" themes, and any theme switch.
- The centre session pill, search, the settings dialog, the quick-list toggle, the connection dot and the host footer.
- The "Managed Sessions" screen with its filters, "Open" and delete buttons.
- The permission banner with "Approve" and "Deny", the prompt composer, the model chip.
- The name, model and initial-prompt fields of the new-session dialog.
- The shortcuts ⌘1, ⌘2, ⌘B and "/".
- The mock's Google fonts.
- Any behaviour change.
- Phone and small-screen layouts.
