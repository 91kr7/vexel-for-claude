---
request_slug: ui_restyle
date: 2026-11-14
type: evolution
size: ordinary
reference: .sdd/analysis/project_list_actions.md
---

# Analysis — UI restyle: top bar, window buttons, project row, session star, terminal

## Request

> Restyling UI di Vexel, cinque modifiche approvate dall'utente sul mock https://claude.ai/artifact/CVjcveX7tdqwGrbRj6Vw8h (file locale: /tmp/claude-767606193/-home-christian-mariani--local-app-vexel-for-claude/1011809b-c911-4460-b135-3aa65634938e/scratchpad/project-row-mock.html). Solo queste, nient'altro:
>
> 1. Top bar (src/web/TopBar.tsx, .top-bar in src/web/styles.css): altezza da 48px a 44px; rimuovere il pulsante "New Session" dalla top bar (resta il FAB "+" della NavigationRail e la scorciatoia).
> 2. Pulsanti finestra desktop (src/web/WindowButtons.tsx look 'vexel', .window-button in styles.css, token --window-* in src/web/theme/tokens.css): stile macOS 27 Golden Gate, cerchi piatti a tinta piena 12px, gap 8px, colori close #e0443c, minimize #e8b616, maximize #25b033, bordino chiaro di 0.5px (box-shadow 0 0 0 0.5px color-mix(colore 45%, #fff)); nessun riflesso/ombra a riposo; simboli visibili in hover sul gruppo come oggi; il pulsante sotto il mouse si illumina: filter brightness(1.08) + alone box-shadow 0 0 8px 1px color-mix(colore 60%, transparent), transition 0.2s; :active brightness(.85). Il look windows11 non va toccato.
> 3. Riga progetto (src/web/folders/ProjectList.tsx, ProjectFavoriteButton.tsx, ProjectRemoveButton.tsx, styles.css .project-row*): rimuovere la pill "▶ New session" (il clic sulla riga avvia già la sessione); la stella diventa un pulsante accanto al nome nella prima riga (al posto del FavoriteIndicator): se preferito sempre visibile ambra piena, altrimenti contorno visibile solo in hover/focus della riga, al clic si accende (piccola animazione pop, rispettando prefers-reduced-motion); resta solo la X di rimozione: cerchietto 22px, X sottile 10px grigia, centrata verticalmente a destra in una colonna riservata (padding-right 36px della riga, così non copre mai il percorso), visibile in hover/focus, in hover sfondo e colore rosso tenue (token rose). Togliere il tooltip nativo title sul percorso. Mantenere le chiamate API e i messaggi di errore esistenti.
> 4. Stella nelle sessioni (src/web/sessions/SessionList.tsx, FavoriteButton.tsx, styles.css .entry-favorite): la stella esce dall'angolo in alto a destra e va accanto al nome della sessione nella prima riga, con lo stesso comportamento della riga progetto; in alto a destra resta solo la matita Rename. Vale anche per le NeedsInputCard. Mantenere la logica di favorite esistente.
> 5. Terminale (styles.css .session-terminal-panel): margin da "16px 16px 0" a "16px", così il focus ring (2px + offset 2px) non va più in overlay sul footer della sessione.
>
> Aggiornare/aggiungere test unitari ed e2e impattati (es. test che cercano il pulsante New Session nella top bar o la pill "New session" nella riga progetto). Commit senza righe di attribuzione AI (vedi CLAUDE.md globale).

## Reference

- [project_list_actions.md](project_list_actions.md) → each project row offers remove and favorite actions. A favorite shows a star on its row.
- [favorite_session.md](favorite_session.md) → the user marks a session as favorite from its list entry, which then shows a favorite indicator.
- [mac_title_bar.md](mac_title_bar.md) → in the desktop app the top bar carries three macOS-style window buttons. All three show their symbol while the pointer is over the group.

Changes:
- The top bar is lower and has no "New Session" button.
- The macOS-style window buttons get a flat look and a glow on hover.
- The project row loses its "New session" pill and its path tooltip. The star moves next to the name and becomes the favorite action. The remove action gets a new look and a reserved place.
- In the session list and in the cards of sessions waiting for input, the star moves next to the session name.
- The terminal panel gets a margin at its bottom too.
- Every other requirement of the three references stays true: the favorite and remove logic, the data they keep, their sync, and their error messages.

## Summary

Five visual changes approved by the user on a mock. Only these five change. Every behaviour not named below stays as it is today.

## Requirements

### Functional

Top bar
- The top bar must be 44px high instead of 48px.
- The top bar must not show the "New Session" button.
- The user must still start a new session from the "+" button of the navigation rail and from the keyboard shortcut.

Window buttons (desktop app, macOS look)
- Each button must be a flat circle of 12px with a solid colour. The buttons must be 8px apart.
- The colours must be: close `#e0443c`, minimize `#e8b616`, maximize `#25b033`.
- Each button must have a thin 0.5px light border, made from its own colour mixed with white.
- At rest the buttons must show no gloss and no shadow.
- The symbols must show on all three buttons while the pointer is over the group, as today.
- The button under the pointer must get a little brighter and show a soft glow in its own colour. The change must take 0.2s.
- A pressed button must get darker.
- The Windows 11 look of the window buttons must not change.

Project row
- The row must not show the "New session" pill. A click on the row still starts a session.
- The star must be a button next to the project name, on the first line of the row. It replaces the current favorite indicator.
- On a favorite project the star must always show, filled in amber.
- On any other project the star must show as an outline, and only while the row is hovered or has focus.
- A click on the star must mark the project. The star then fills, with a short "pop" animation.
- The animation must not play when the user's system asks for reduced motion.
- The remove action must be the only other action on the row. It must be a 22px circle with a thin grey X of 10px.
- The remove action must sit at the right end of the row, centred in height, in a column kept free for it. It must never cover the folder path.
- The remove action must show only while the row is hovered or has focus.
- On hover the remove action must get a soft red background and a soft red X.
- The folder path must not show the native browser tooltip.
- Favorite and remove must keep their current effect and their current error messages.

Session star
- In the session list the star must leave the top-right corner. It must sit next to the session name, on the first line of the entry.
- The session star must look and behave like the project star above.
- The top-right corner must keep only the Rename action.
- The cards of sessions waiting for input must follow the same rule.
- The favorite mark must keep its current logic.

Terminal
- The terminal panel must have a 16px margin on all four sides. Today its bottom margin is 0.
- The focus ring of the terminal must not overlap the session footer.

### Non-functional

- The star and the remove action must be reachable with the keyboard. Each must show when it has focus, even on a row that is not hovered.
- The star must keep an accessible name that tells the user whether a click marks or unmarks.
- A marked and an unmarked star must differ by shape (filled or outline), not only by colour.

## Assumptions

All are gatekeeper decisions, not human decisions.

- This is an evolution, not a fix. The request removes visible controls and changes the look on purpose. It corrects no earlier requirement.
- The terminal margin is a visual defect. It stays in this analysis because it belongs to the same request.
- The mock approved by the user decides any visual detail that the request does not state.
- "Hover/focus of the row" also covers focus on a control inside the row. Otherwise a keyboard user could not reach the star or the remove action.
- A click on the star or on the remove action acts only on that control and does not start a session, as today.
- The rose and amber colours come from the current theme, so the light and dark themes both keep them.
- The resume history keeps its favorite indicator as it is. The request does not name it.

## Risks

- The unmarked star and the remove action show only on hover or focus. A new user may not find them.
- Without the top bar button, a user who knew only that button must find the "+" of the rail or the shortcut.

## Scope

In scope:
- The five changes above, in the browser and in the desktop app.
- Updating the unit and e2e tests that these changes affect, such as tests that look for the top bar "New Session" button or the row's "New session" pill.

Out of scope:
- Any visual change not listed in the request.
- The Windows 11 look of the window buttons.
- Changes to the favorite or remove logic, their stored data, or their error messages.
- The favorite indicator in the resume history.
- The "+" button of the navigation rail and the new-session keyboard shortcut.
