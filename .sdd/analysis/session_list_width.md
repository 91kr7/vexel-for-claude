---
request_slug: session_list_width
date: 2026-11-07
type: fix
size: ordinary
reference: .sdd/analysis/claude_sessions_client-ui_redesign-material3_mock-studio_dark.md
---

# Analysis — Resizable session list, and a lighter session header

## Request

> fai in modo che la barra delle sessioni sia ridimensionabile. è possibile fare in modo che la larghezza sia salvata così se chiudo l'app me la propone larga uguale?

> puoi mettere nell'analisi anche un restiling nell'heade che mostra persorso, contesto, token, stato della sessione ecc? c'è troppa roba su una sola riga!!! magari alcune cose si possono spostare nel rooter in cui c'è la shortcur ctrl+shift

> riapri l'ultimo batch fixa il fatto che il tasto lente di ingrandiento per cercare in console sia fra i lbottone dello stato e l'interrupt!!! in ordine devono esserci: lente, stato, interrupt (magari mettiamo un icona di pausa e colore arancione anzichè rosso) e terminate.
> inoltre fixa tutti i test che non vanno, anche se non centrano con le modifiche da te fatte! io vado a dormire! esegui tutto in autonomia

## Reference

[claude_sessions_client-ui_redesign-material3_mock-studio_dark.md](claude_sessions_client-ui_redesign-material3_mock-studio_dark.md) → the Studio restyle. It sets the list panel to a fixed 224 px width (lines 23 and 105). The session header is a 40 px subbar with folder name, path, state badge and actions (line 83). A hint under the terminal shows the key that moves the focus to the list (line 88).

[session_usage.md](session_usage.md) → it added context, tokens and cost to the header, with the four token parts in full (lines 34-46).

Changes:
- The user can change the width of the list panel. 224 px becomes the default width.
- The client remembers the chosen width across reloads and restarts.
- The session header keeps only the session identity, its state and its actions.
- The path and the usage figures move to a footer bar under the session.
- The key hint under the terminal goes away. The key keeps working.
- The four token parts move from the visible text to a tooltip.
- Every other requirement of the references stays true.

Fix 2026-11-07:
- The hosted session header shows its items in this order: search, state badge, interrupt, stop.
- The interrupt action uses an orange pause icon instead of a red one.
- Every failing test of the project is fixed, also the tests not related to this feature.

## Summary

The user can drag the right edge of the session list panel to make it wider or narrower. The app remembers the width. The session header becomes shorter: the path and the usage figures move to a footer bar under the session. The header actions follow a fixed order, and the whole test suite passes.

## Requirements

### Functional

List panel width
- The user must be able to change the width of the list panel by dragging its right edge.
- The edge must show that the user can drag it, on hover and on keyboard focus.
- The panel width must stay between 180 px and 480 px.
- The main area must keep at least 700 px of width.
- When the window is too narrow for the saved width, the panel must show narrower. The saved width must not change.
- The saved width must change only when the user resizes the panel.
- With no saved width, the panel must be 224 px wide.
- The client must remember the width across page reloads and app restarts.
- On start, the panel must show the saved width from the first frame, with no jump.
- At every width, entry texts must keep their current lines and be cut with an ellipsis when they do not fit.
- After a resize, the terminal of the open hosted session must fill its panel again. Claude Code must receive the new number of columns, as after a window resize ([terminal_addons.md](terminal_addons.md), line 66).
- The user must be able to reach the edge with the keyboard and change the width with the arrow keys, with visible focus.

Session header
- The header of a hosted session must show only the folder name, the session label or name, the search action, the state badge, and the interrupt and stop actions.
- In a hosted session header, these items must show from left to right in this order: search, state badge, interrupt, stop.
- The keyboard focus must move through them in the same order.
- The interrupt action must show a pause icon in orange, not red. Its behaviour, accessible name and tooltip must not change.
- The orange must look different from the amber of the needs-input state.
- The orange icon must meet WCAG 2.2 AA non-text contrast (3:1) in the dark and in the light theme.
- The stop action must keep its current look.
- The header of an external session must show only the folder name, the session label or name, the state badge, the read-only chip and the resume-here action.
- The header must stay on one line at every main area width from 700 px up. Its items must never overlap or wrap.
- A label or name that does not fit must be cut with an ellipsis, and the full text must show on hover and on focus.

Footer bar
- Every open session, hosted or external, must show a one-line footer bar under its terminal or conversation.
- The footer must show the folder path, the context occupancy, the total tokens and the estimated cost.
- On an external session, the footer must keep the text that says the session is open in another terminal, before the path.
- The footer must not show the key that moves the focus from the terminal to the list. That key must keep working.
- On a hosted session, the terminal text size controls must show at the right end of the footer.
- The four token parts (input, output, cache write, cache read) must show in a tooltip on the token total, on hover and on keyboard focus.
- The context occupancy must keep its 70% and 90% highlights in the footer.
- A path that does not fit must be cut with an ellipsis, and the full path must show on hover.
- When figures are missing or partial, the footer must follow the rules of [session_usage.md](session_usage.md), lines 59-60: no figures before the first response, and the last figures on an ended session.

Text
- Any new text, such as the accessible name of the panel edge, must be in English, like the rest of the UI.

### Non-functional

- While the user drags, the panel must follow the pointer with no visible lag.
- The footer must stay one line high, so the terminal keeps its number of rows.
- The header must keep the 40 px height of the reference.

### Test suite

- At the end of this fix, every test group of the project must run and pass, including the separate Electron e2e group.
- This includes tests that fail for reasons not related to this feature.
- A failing test must be fixed at its cause. When the product breaks a requirement of a current analysis, the product changes. When the test checks a behaviour that a later analysis changed, the test changes.
- A test must not be skipped, deleted or weakened only to make the run pass. It may be removed only when no current analysis keeps the behaviour it checks.
- A test that fails only on some runs counts as failing. It must pass on repeated runs.
- The tests of the session header must check the new order and the new interrupt icon and colour.
- If a test cannot run on this machine, the closing report must name it and give the reason.

## Assumptions

- This is an evolution, not a fix. The 224 px width and the header content were deliberate choices. The orchestrator decided this.
- "Barra delle sessioni" means the session list panel. The 52 px rail does not change.
- The 180-480 px limits keep entries readable and the main area usable. The orchestrator decided this.
- The 700 px floor holds at the 1280 px minimum window width: 1280 − 52 − 480 leaves about 750 px.
- The client remembers the width where the user chose it, like the theme ([light_theme.md](light_theme.md), line 62) and the terminal font size ([terminal_addons.md](terminal_addons.md), line 95). The desktop app and a browser can each keep their own width.
- "Rooter" means the bar under the terminal that shows the key hint today. It is the hint bar of the Studio reference (line 88).
- The header keeps what tells the user which session this is and what they can do with it. The path and the figures describe the session, so they move to the footer.
- The footer follows Claude Code's own status line, which shows context and cost under the prompt ([status line](https://code.claude.com/docs/en/statusline)).
- External sessions get the same footer, so both session views place the same information in the same spot.
- The four token parts go into a tooltip, because the human asked for less text on one line. No figure is lost.
- The terminal search stays in the header and the text size controls go to the right end of the footer. The human decided this on 2026-11-06: "lo zoom mettilo in basso a destra mentre il search va bene in alto".
- The key hint goes away. The human decided this on 2026-11-07: "nel footer mi aggiungi anche di togliere l'indicazione della shortcut per tornare al menù? è totalmente inutile e magari ti farò implementare in futuro un sistema di shortcut".
- The 2026-11-07 change is a fix of this analysis, not a new evolution. The human said "riapri l'ultimo batch fixa".
- "Lente" means the terminal search action. "Terminate" means the stop action.
- The pause icon and the orange colour are decided, although the human wrote "magari". The human asked to work alone and is not available.
- The external session header does not change. It has no search, interrupt or stop action.
- The orange applies to the interrupt action only. The accent stays light blue ([studio_dark](claude_sessions_client-ui_redesign-material3_mock-studio_dark.md), line 24).
- "Tutti i test" means every test group the project defines, unit and e2e, with the Electron group included.

## Risks

- Claude Code redraws its screen on each column change. Many changes during one drag can make the terminal flicker or show a broken frame for a moment.
- The context warning at 70% and 90% moves to the bottom of the view. A user who looks at the header may notice it later.
- The orange interrupt sits next to the state badge. If the badge is amber (needs input), the user may read the two as one signal.
- A failing test may show a real bug in another feature. Its fix then changes that feature, while the human is not available to review it.
- Some tests may fail because of the machine and not the code, for example the Electron e2e group without a display.

## Scope

In scope:
- Resizing the session list panel with the mouse and the keyboard.
- Remembering the panel width across reloads and restarts.
- A shorter header and a footer bar for hosted and external sessions.
- The order of the hosted header items and the look of the interrupt action.
- Fixing every failing test of the project.

Out of scope:
- Collapsing or hiding the panel.
- A reset action, such as a double-click to bring back the default width.
- Resizing any other area, including the rail.
- Remembering the window size and position.
- New figures or new actions in the header or the footer.
- Any change to how the usage figures are computed.
- A footer that the user can configure.
- A system of keyboard shortcuts.
- The look of any other button, including the stop action.
- New tests for features not touched by a fix.
- Changing another analysis so that a test passes.
