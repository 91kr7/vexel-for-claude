---
request_slug: claude_sessions_client-ui_redesign-material3_mock
date: 2026-11-05
type: evolution
size: ordinary
reference: .sdd/analysis/claude_sessions_client-ui_redesign.md
---

# Analysis — Restyle of the client to the "Vexel for Claude" Material 3 mock

## Request

> orchestra il flusso sdd trasformandomi la grafica di questa app in quella raffigurata in questo mock! segui alla lettera la grafica del mock ed assicurati che al developer venga specificato chiaramente che deve essere identica al mock e che il mock venga effettivamente passato. il mock lo trovi qui: ~/Downloads/Vexel for Claude — Material 3 mockups.html attenzione che i mock da rispettare sono quelli delle sezioni il cui titolo è: "Proposta — *"  pensaci tu come orchestratore a rispondere a qualsiasi domanda! io non sarò al pc! di al developer di usare colori più maschili! o blu chiaro o grigio!

## Reference

[claude_sessions_client-ui_redesign.md](claude_sessions_client-ui_redesign.md) → a redesign of every screen and dialog of the Claude sessions client, with no behaviour change. It set requirements on readability, states, themes and keyboard use. It left the visual style to the later phases, because the human gave no visual reference.

Changes:
- The style is no longer free. The mock in `.sdd/mockups/vexel-material3/` fixes it, and the result must be identical to it.
- The violet palette of the mock becomes light blue and grey, by the human's request.
- The page shows the name and logo "Vexel for Claude".
- The mock adds some visible elements: a navigation rail, groups in the list, a needs-input card with "Rispondi", an in-page alert (snackbar), an "Interrompi" button, recent folders in the new-session dialog, a "N nuovi messaggi" button.
- In the stop confirmation the initial focus is on "Annulla". Enter there cancels and does not stop the session.
- Every other requirement of the reference stays true.

## Summary

Make every screen and dialog of the client identical to the "Proposta — *" boards of the mock, in light and dark theme. A light-blue and grey palette replaces the violet one.

## Requirements

### Functional

Visual reference
- The four boards listed in `.sdd/mockups/vexel-material3/README.md` must be the binding visual reference of every screen.
- Each screen must reproduce its board identically: layout, sizes, radii, spacing, typography, icons, texts and colour roles.
- The only allowed differences are the palette below, real data in place of sample data, and the decisions of this analysis.
- Where two boards differ, "Sessione ospitata" must win for the rail, the list panel and the needs-input entry. "Voci dell'elenco" must win for the entry states that only it shows.
- The board "Oggi — screenshot dell'app" must not be used as a target.

Palette
- The primary colour and its tonal family must become light blue.
- Every other violet-tinted colour must become neutral grey: secondary containers, surfaces, outlines, the terminal background.
- Status colours must stay as in the mock: amber for needs input, red for errors, green for success, teal for avatars, ember for the logo and Claude messages.
- Each new colour must keep the lightness of the colour it replaces, in both themes.

Whole page
- A navigation rail on the left must show the logo, a "Nuova sessione" button, and the destinations "Sessioni" and "Riprendi".
- "Nuova sessione" must open the new-session dialog, and "Riprendi" must open the existing resume history.
- The "Sessioni" destination must carry a badge with the number of sessions that need input, hidden at zero.
- The list panel must show the brand "Vexel for Claude", the title "Sessioni" and the chip "N richiede input", hidden at zero.
- The browser page title must be "Vexel for Claude".
- The UI must use Roboto Flex, and Roboto Mono for paths, code and the terminal.
- When a session that is not open starts to need input, a snackbar "<progetto> richiede il tuo input" with "Apri" must appear at the bottom of the main area.
- The snackbar must disappear when the user opens that session or the session no longer needs input.

Session list
- The list must show these groups in this order: "Richiedono input", "In corso", "In altri terminali", "Terminate". An empty group must be hidden.
- "Richiedono input" must hold every session that needs input, hosted or external.
- "In corso" must hold hosted sessions that work or wait. "In altri terminali" must hold external sessions that work or wait. "Terminate" must hold ended sessions.
- Each entry must show an avatar with the project initials, the folder name as title, the label below it, the state with icon and text, and the time of last activity.
- The state texts must be "Lavora", "In attesa", "Richiede input" and "Terminata", each with its icon from the mock.
- A working entry must show an animated, indeterminate progress bar under the label.
- A needs-input entry must be the amber card of "Sessione ospitata": the line "Permesso per <strumento> · <tempo>" and a "Rispondi" button that opens the session.
- An external entry must have the dashed border and the outlined avatar with the terminal icon.
- In "Richiedono input", an external entry must show the "Esterna" tag and no "Rispondi" button.
- The open entry must use the highlighted background of the mock. An ended entry must be dimmed as in "Voci dell'elenco".

Hosted session
- The header must show the avatar, the folder name, a state chip, the label with the folder path, and the buttons "Interrompi" and "Termina".
- "Interrompi" must interrupt the current turn, as the terminal interrupt does.
- "Interrompi" and "Termina" must not appear on an ended session.
- The terminal must sit in the rounded dark panel of the board.
- A hint under the terminal must show the key that moves the focus from the terminal to the list.

External session
- The header must show the outlined terminal avatar, the folder name, a state chip, the chip "Sola lettura", the line "Aperta in un altro terminale · <percorso>" and a filled "Riprendi qui" button.
- User messages must be right-aligned bubbles in the primary colour, with their time.
- Claude messages must be left-aligned with the ember spark icon.
- Inline code in Claude messages must be a mono chip.
- Each tool call must be a collapsible card: tool icon, tool name, main argument in mono, outcome chip, chevron. An open card shows the output in mono.
- The outcome chip must be green "Fatto" on success and red "Fallito" on failure.
- When new content arrives while the user reads earlier content, a "N nuovi messaggi" button must appear. A click scrolls to the end.

Dialogs
- The new-session dialog must match its board: the field "Cartella del progetto", the list "Recenti", the buttons "Annulla" and "Avvia sessione".
- "Recenti" must list the project folders of the user's past sessions, most recent first. Choosing one fills the field.
- The stop confirmation must match its board, with the session name and the consequence text. "Annulla" has the initial focus.
- The resume history must use the layout of the new-session dialog. The running-elsewhere warning must use the layout of the stop confirmation, in amber colours.
- Every dialog must darken the page behind it as in the board.

### Non-functional

- At 1440 x 900 px, with data equal to a board's sample data, each screen must match its board in both themes, except for the colour swap.
- The non-functional requirements of the reference stay: WCAG 2.2 AA contrast, keyboard use with visible focus, 1280 px minimum width, about one second to open a session.

## Assumptions

- This is an evolution, not a fix. The reference left the style open and was not wrong. The orchestrator decided this, because the human is away.
- Light blue for accents and grey for neutrals. Grey alone would leave no accent for the open session and the primary actions.
- "Blu chiaro" names the hue. In the light theme, text and filled buttons need a darker tone of it to meet contrast.
- Names, messages, times and texts such as "14 superati" in the boards are sample data, not content to reproduce.
- Initials are the first letters of the first two words of the folder name. Words split on "-", "_" and spaces. A single word gives its first two letters.
- Each project keeps a stable avatar colour and shape, chosen from the mock's variants. Amber replaces it for needs input, grey for ended.
- The progress bar is indeterminate, because a Claude turn has no measurable progress.
- When the client does not know which tool waits for permission, the needs-input line shows the label instead.
- Times read "ora" under one minute, "N min fa" under one hour, then the clock time, then the date on earlier days.
- Ended sessions get their own group "Terminate", because no board shows where they go.
- UI texts become those of the mock where the mock shows them. Elsewhere the current Italian texts stay.
- Empty, loading and error states have no board. They keep their behaviour and use the mock's colours, type and shapes.
- An existing feature that the mock does not show stays, drawn with the mock's parts.
- The hint under the terminal names the key the client really uses.
- "Vexel for Claude" is a display name only.

## Constraints

- Every later phase must cite `.sdd/mockups/vexel-material3/` as the visual reference and pass it on.
- The developer must open the board files and reproduce them. A description of the mock does not replace them.
- The mock folder must be committed and stay in the repository.
- The fonts in the mock folder (SIL Open Font License 1.1) must ship with the client. The client must not contact outside servers to draw its pages.
- The restyle must not remove any terminal feature of hosted sessions.

## Risks

- Light blue at its literal lightness fails contrast on light surfaces.
- Real data longer than the sample data, such as long folder names or labels, can break a layout drawn for short ones.
- Some mock elements need data the client may not have: the waiting tool, the tool-call outcome, the recent folders.
- The restyle can break existing behaviour: live updates, needs-input ordering, "Riprendi qui", the key that leaves the terminal.

## Scope

In scope:
- The restyle of every screen and dialog to the mock, in light and dark theme, with the palette swap.
- The visible elements the mock adds, listed in Reference.
- The name and logo "Vexel for Claude" inside the page.

Out of scope:
- The board "Oggi — screenshot dell'app".
- Any behaviour change beyond those listed in Reference.
- A theme switch inside the client: the theme follows the operating system only.
- Search, filters, grouping by project, shortcuts to switch sessions.
- Operating system notifications.
- Reformatting the content of a hosted session's terminal.
- Renaming the project, its packages or its repository.
- Phone and small-screen layouts.
