---
slug: claude_sessions_client-ui_redesign-material3_mock-studio_dark
date: 2026-11-06
spec: .sdd/analysis/claude_sessions_client-ui_redesign-material3_mock-studio_dark.md
status: validated
---

# Requirements — Dark "Studio" restyle of the client

"The mock" is `.sdd/mockups/studio-dark/mock.html`, in its default dark theme (the `:root` values). "Accent" is the light blue that replaces the mock's orange. "Mock style" of an element means the look of the mock element with the same role: sizes, radii, borders, spacing, type sizes and weights, colours, hover, focus and active states.

## Feature: Theme and palette

| ID | Requirement |
|----|-------------|
| REQ-1 | The client always shows the dark theme, also when the operating system uses the light theme. |
| REQ-2 | Scrollbars and native form controls render dark. |
| REQ-3 | Scrollbars are the thin rounded scrollbars of the mock. |
| REQ-4 | Canvas, surfaces, borders, the top highlight of surfaces and the text colours use the mock's `:root` values. The only exception is a text colour changed by REQ-51. |
| REQ-5 | Wherever the mock uses `--accent-primary`, `--accent-secondary`, `--accent-glow` or `--accent-border`, the client uses the light-blue accent, with the glow at 16 % and the border at 42 % opacity. |
| REQ-6 | The dark end of the mock's accent gradients (`#9a3412`, `#b8431b`) is a darker tone of the same light blue. |
| REQ-7 | Selected text uses the accent at 30 % opacity. |
| REQ-8 | The status colours are emerald for "Lavora", amber for "Richiede input", rose for errors and "Fallito", zinc for "In attesa" and "Terminata". |
| REQ-9 | The status dots of "Lavora" and "Richiede input" pulse with the mock's animation. |

## Feature: Typography

| ID | Requirement |
|----|-------------|
| REQ-10 | The UI uses Roboto Flex wherever the mock uses Plus Jakarta Sans or Instrument Serif. |
| REQ-11 | The UI uses Roboto Mono wherever the mock uses JetBrains Mono: paths, times, chips, labels, tool names, code and the terminal. |
| REQ-12 | Group titles and section labels are small mono uppercase labels in the muted colour, in the style of the mock's "Orchestrated Sessions" label. |

## Feature: Page frame

| ID | Requirement |
|----|-------------|
| REQ-13 | The client fills the whole window, with no outer margin and no rounded frame. |
| REQ-14 | A 48 px top bar shows the logo and "Vexel for Claude" on the left and an accent "Nuova sessione" button on the right. The rail and the list panel no longer show the logo or the brand. |
| REQ-15 | "Nuova sessione" in the top bar opens the new-session dialog. |
| REQ-16 | The logo is the mock's square mark with the accent gradient. |
| REQ-17 | A 52 px rail shows the accent "Nuova sessione" button, a divider, then "Sessioni" and "Riprendi" as icon buttons, all 34 x 34 px. |
| REQ-18 | A rail button shows its name in a tooltip on hover, and no label under the button. |
| REQ-19 | The active rail destination has the mock's active style: accent glow, accent border and the 2.5 px bar on the left. |
| REQ-20 | The badge of "Sessioni" is small and amber, on the corner of its button. |
| REQ-21 | The list panel shows the title "Sessioni" and the chip "N richiede input" in the mock style of the list header. |
| REQ-22 | The main area shows the mock's dot-grid background. |

## Feature: Session list

| ID | Requirement |
|----|-------------|
| REQ-23 | Each entry has the mock style of a session row: status dot in place of the project avatar, folder name, mono details on the right, 6 px radius, surface 2 on hover. |
| REQ-24 | The entry of the open session has the mock's active row style: accent glow and a 2 px accent bar on the left. |
| REQ-25 | An entry keeps its current content, and is taller than the mock's 30 px row only by the lines that content needs. |
| REQ-26 | A working entry keeps its progress bar, in emerald. |
| REQ-27 | An external entry keeps its dashed border. |
| REQ-28 | The needs-input card has the mock style of the permission banner (surface 2, amber border, amber tag), and its "Rispondi" is an accent button. |
| REQ-29 | An ended entry stays dimmed. |

## Feature: Session view

| ID | Requirement |
|----|-------------|
| REQ-30 | The session header is the mock's 40 px subbar: folder name, "/", mono path, state badge, then the actions on the right. It shows no project avatar. |
| REQ-31 | The state badge is the mock's tinted mono pill with its dot. |
| REQ-32 | "Interrompi" and "Termina" have the mock style of the rose stop button. |
| REQ-33 | "Riprendi qui" is an accent button, and "Sola lettura" is a neutral mono chip. |
| REQ-34 | The terminal sits on the canvas colour, in a panel with the mock's subtle border, with 12 px mono text. |
| REQ-35 | The hint under the terminal shows its key in the mock's keyboard badge. |
| REQ-36 | Each message shows a 24 px square avatar, a name line ("Tu" or "Claude") with a mono time, then the text. |
| REQ-37 | User messages are left-aligned, with the text in a surface-2 box. |
| REQ-38 | The Claude avatar is the accent square with "✦". |
| REQ-39 | Each tool call is the mock's tool card: tool name chip in accent, target in mono, outcome in coloured mono text with "▾", output on the canvas colour. |
| REQ-40 | Inline code is a mono chip. |
| REQ-41 | The snackbar and the "N nuovi messaggi" button have the mock style of the glass toast. |
| REQ-42 | The snackbar sits at the bottom right of the window. |

## Feature: Dialogs

| ID | Requirement |
|----|-------------|
| REQ-43 | Every dialog has the mock's modal style: black backdrop at 65 % with blur, surface 2, strong border, 12 px radius, then header, body and footer. |
| REQ-44 | The dialog header shows the accent dot, the title and a mono "[Esc]" control. |
| REQ-45 | A click on "[Esc]" closes the dialog in the same way as "Annulla". |
| REQ-46 | Field labels are 11 px mono, and fields sit on the canvas colour and take the accent border on focus. |
| REQ-47 | The dialog footer sits on surface 1, with "Annulla" as a neutral button and the main action as an accent button. |
| REQ-48 | The main action of the stop confirmation has the rose style. |
| REQ-49 | The running-elsewhere warning uses amber, in the mock style of the permission banner. |
| REQ-50 | The empty, loading and error states use the layout of the mock's empty state, without the serif font. |

## Feature: Size and contrast

| ID | Requirement |
|----|-------------|
| REQ-51 | All text meets WCAG 2.2 AA contrast. Where a mock value fails, as the muted `#686773` on surface 1 does, the text colour gets lighter only as much as needed. |
| REQ-52 | Text on an accent-filled button reaches 4.5:1 against the light blue. |
| REQ-53 | At 1440 x 900 px the top bar is 48 px high, the rail 52 px wide, the rail buttons 34 x 34 px, the list panel 224 px wide and the session subbar 40 px high. |

## Constraints on the whole plan

These are not REQs: they apply to every REQ above, so no single intervention closes them.

- The mock is the binding visual reference. Each existing element copies the mock style of the element with the same role. The developer opens the mock file and reads its values: a description does not replace it.
- An existing element with no counterpart in the mock is built from the mock's parts: surfaces, borders, chips, buttons, mono labels.
- Only the look changes. No behaviour is added, except REQ-15 and REQ-45. The mock's extra features listed as out of scope in the spec are not built.
- UI texts stay the current Italian ones. The mock's English texts are not used.
- The client serves its own Roboto Flex and Roboto Mono and contacts no outside server. The mock's Tailwind CDN and Google Fonts links are not copied.
- The mock file stays committed and unchanged in the repository.
- Every requirement of `plan-claude_sessions_client`, `plan-claude_sessions_client-ui_redesign` and `plan-claude_sessions_client-ui_redesign-material3_mock` stays true, unless this plan states otherwise. This covers keyboard use, visible focus, the 1280 px minimum width, the one-second open time and the terminal features of hosted sessions. This plan changes: the light theme (REQ-1), the ember colour (REQ-5, REQ-16, REQ-38), the brand position (REQ-14), the project avatar (REQ-23, REQ-30), the user message alignment (REQ-37) and the snackbar position (REQ-42).
- `.sdd/mockups/vexel-material3/` is no longer the visual reference. It still says which elements exist and what they show. The requirements of the previous plan that ask a screen to match a board now mean: match the mock.
