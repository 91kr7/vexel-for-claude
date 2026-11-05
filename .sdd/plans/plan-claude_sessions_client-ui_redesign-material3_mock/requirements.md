---
slug: claude_sessions_client-ui_redesign-material3_mock
date: 2026-11-05
spec: .sdd/analysis/claude_sessions_client-ui_redesign-material3_mock.md
status: validated
---

# Requirements — Restyle of the client to the "Vexel for Claude" Material 3 mock

The visual reference is `.sdd/mockups/vexel-material3/`. A "board" is one of its four `proposta-*.html` files. "Palette swap" means the colour changes of REQ-1 to REQ-4.

## Feature: Colours and type

| ID | Requirement |
|----|-------------|
| REQ-1 | The primary colour and its tonal family are light blue, in both themes. |
| REQ-2 | Every colour that is violet-tinted in the mock is neutral grey in the client: secondary containers, surfaces, outlines and the terminal background. |
| REQ-3 | The status colours are those of the mock: amber for needs input, red for errors, green for success, teal for avatars, ember for the logo and Claude messages. |
| REQ-4 | Each colour that replaces a mock colour keeps the lightness of that colour (CIELAB L*, within ±2), in both themes. |
| REQ-5 | The UI text uses Roboto Flex, and paths, code and the terminal use Roboto Mono, both served by the client itself. |

## Feature: Page frame

The navigation rail, the head of the list panel, the page title and the snackbar.

| ID | Requirement |
|----|-------------|
| REQ-6 | A navigation rail on the left of the page shows the logo, a "Nuova sessione" button and the destinations "Sessioni" and "Riprendi". |
| REQ-7 | "Nuova sessione" in the rail opens the new-session dialog. |
| REQ-8 | "Riprendi" in the rail opens the resume history. |
| REQ-9 | The "Sessioni" destination carries a badge with the number of sessions that need input, and the badge is hidden at zero. |
| REQ-10 | The list panel shows the brand "Vexel for Claude" and the title "Sessioni". |
| REQ-11 | The list panel shows the chip "N richiede input", where N is the number of sessions that need input, and the chip is hidden at zero. |
| REQ-12 | The browser page title is "Vexel for Claude". |
| REQ-13 | When a session that is not open starts to need input, a snackbar "<progetto> richiede il tuo input" with the action "Apri" appears at the bottom of the main area. |
| REQ-14 | "Apri" in the snackbar opens that session. |
| REQ-15 | The snackbar disappears when the user opens that session or when that session no longer needs input. |

## Feature: Session list

| ID | Requirement |
|----|-------------|
| REQ-16 | The list shows the groups "Richiedono input", "In corso", "In altri terminali" and "Terminate", in this order, and hides an empty group. |
| REQ-17 | The group "Richiedono input" holds every session that needs input, hosted or external. |
| REQ-18 | "In corso" holds the hosted sessions that work or wait, "In altri terminali" holds the external sessions that work or wait, and "Terminate" holds the ended sessions. |
| REQ-19 | Each entry shows an avatar with the project initials, the folder name as title, the label below it, the state with icon and text, and the time of the last activity. |
| REQ-20 | The state texts are "Lavora", "In attesa", "Richiede input" and "Terminata", each with its icon from the mock. |
| REQ-21 | A working entry shows an animated, indeterminate progress bar under the label. |
| REQ-22 | A needs-input entry is the amber card of board "Sessione ospitata", with the line "Permesso per <strumento> · <tempo>" and a "Rispondi" button. |
| REQ-23 | "Rispondi" opens the session. |
| REQ-24 | An external entry has a dashed border and an outlined avatar with the terminal icon. |
| REQ-25 | In the group "Richiedono input", an external entry shows the tag "Esterna" and no "Rispondi" button. |
| REQ-26 | The entry of the open session has the highlighted background of the mock. |
| REQ-27 | An ended entry is dimmed as in board "Voci dell'elenco". |
| REQ-28 | Each entry variant matches its variant in board "Voci dell'elenco", in both themes, except for the palette swap. |

## Feature: Hosted session

| ID | Requirement |
|----|-------------|
| REQ-29 | The header of a hosted session shows the avatar, the folder name, a state chip, the label with the folder path, and the buttons "Interrompi" and "Termina". |
| REQ-30 | "Interrompi" interrupts the current turn, as the terminal interrupt does. |
| REQ-31 | "Interrompi" and "Termina" do not appear on an ended session. |
| REQ-32 | The terminal sits in the rounded dark panel of board "Sessione ospitata". |
| REQ-33 | A hint under the terminal shows the key that moves the focus from the terminal to the list. |
| REQ-34 | With the sample data of board "Sessione ospitata", at 1440 x 900 px, the page matches that board in both themes, except for the palette swap. |

## Feature: External session

| ID | Requirement |
|----|-------------|
| REQ-35 | The header of an external session shows the outlined terminal avatar, the folder name, a state chip, the chip "Sola lettura", the line "Aperta in un altro terminale · <percorso>" and a filled "Riprendi qui" button. |
| REQ-36 | User messages are right-aligned bubbles in the primary colour, with their time. |
| REQ-37 | Claude messages are left-aligned, with the ember spark icon. |
| REQ-38 | Inline code in Claude messages is a mono chip. |
| REQ-39 | Each tool call is a collapsible card with the tool icon, the tool name, the main argument in mono, the outcome chip and a chevron. An open card shows the output in mono. |
| REQ-40 | The outcome chip is green "Fatto" on success and red "Fallito" on failure. |
| REQ-41 | When new content arrives while the user reads earlier content, a "N nuovi messaggi" button appears. |
| REQ-42 | A click on "N nuovi messaggi" scrolls the view to the end. |
| REQ-43 | With the sample data of board "Sessione esterna", at 1440 x 900 px, the page matches that board in both themes, except for the palette swap. |

## Feature: Dialogs

| ID | Requirement |
|----|-------------|
| REQ-44 | The new-session dialog has the field "Cartella del progetto", the list "Recenti" and the buttons "Annulla" and "Avvia sessione". |
| REQ-45 | "Recenti" lists the project folders of the user's past sessions, most recent first. |
| REQ-46 | Choosing a folder in "Recenti" fills the field "Cartella del progetto". |
| REQ-47 | The stop confirmation shows the session name and the consequence text. |
| REQ-48 | When the stop confirmation opens, "Annulla" has the focus. |
| REQ-49 | The resume history uses the layout of the new-session dialog. |
| REQ-50 | The running-elsewhere warning uses the layout of the stop confirmation, in amber colours. |
| REQ-51 | Every dialog darkens the page behind it as in board "Dialoghi". |
| REQ-52 | With the sample data of board "Dialoghi", at 1440 x 900 px, the new-session dialog and the stop confirmation match that board in both themes, except for the palette swap. |

## Constraints on every batch

These are not REQs: no single batch can close them, so every batch must keep them true.

- The boards are the binding visual reference. Each screen copies its board: layout, sizes, radii, spacing, typography, icons, texts and colour roles. A description of a board never replaces the board file.
- The only allowed differences from a board are the palette swap, real data in place of sample data, and the decisions of the spec and of this plan.
- Where two boards differ, "Sessione ospitata" wins for the rail, the list panel and the needs-input entry. "Voci dell'elenco" wins for the entry states that only it shows.
- The board "Oggi — screenshot dell'app" is not a target.
- Every requirement of `plan-claude_sessions_client` and `plan-claude_sessions_client-ui_redesign` stays true, unless this plan states otherwise. This covers the terminal features of hosted sessions, contrast, keyboard use, visible focus, the 1280 px minimum width and the one-second open time.
- The mock folder stays committed in the repository.
- UI text stays in Italian. Texts become those of the boards where a board shows them.
