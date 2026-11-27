---
request_slug: subagent_panel
date: 2026-11-27
type: evolution
size: narrow
reference: .sdd/analysis/session_activity.md
---

# Analysis — Subagents panel: running subagents only, as a list

## Request

> Rivedi le analisi del Turn Panel (session_activity) in questo senso: nel pannello vanno mostrati solo i subagent, non i messaggi della chat principale. I passi dell'agente principale (testi di Claude e chiamate a tool) duplicano quello che si vede già nel terminale delle sessioni ospitate e nella conversazione di quelle esterne, e nei turni lunghi spingono in basso le card dei subagent, che sono l'unica cosa nuova che il pannello aggiunge.

> Riapri il piano precedente (.sdd/analysis/subagent_panel.md, .sdd/plans/plan-subagent_panel/) e aggiungi questa evoluzione: nel Turn Panel i subagent vanno resi come lista, non come card affiancate. Una riga a tutta larghezza per subagent, in ordine di avvio dall'alto in basso; i subagent annidati rientrati sotto il padre, come un albero; i subagent lanciati insieme (stesso gruppo) uniti da un segno visivo sulla sinistra, uno sotto l'altro invece che affiancati. Ogni riga mostra gli stessi campi di oggi (tipo, task, modello, stato, durata, ultimo testo, tool in esecuzione) e un clic apre la conversazione del subagent come adesso. Motivo: il pannello sta accanto al terminale ed è stretto; con 2-3 subagent in parallelo le colonne da 180 px tagliano task e ultimo testo, gli annidati si stringono ancora di più dentro la card, l'ordine di avvio si legge a zig-zag e con i workflow (10+ agenti) la griglia diventa un mosaico difficile da scorrere. Cambia REQ-37 di session_activity ("side by side" → uno sotto l'altro, uniti come gruppo).

> guarda questo scenario! ci sono 2 agent che stanno girando ma guarda la barra di destra!

Screenshot: two background subagents started two turns earlier still ran. The panel listed them under "Still running from earlier turns", and below them showed a large "No subagents in this turn." box.

> ma il menù chiamalo semplicemente subagents! e deve mostrare i subagent in esecuzione al momento

## Reference

[session_activity.md](session_activity.md), "Turn panel" (lines 71-86). The panel shows the tree of the current turn. The tree lists every step of the main agent in order: each text of Claude, and each tool call with its state (lines 74-75). A subagent appears at the step that started it (line 76). While the turn runs, the latest step stays visible (line 86).

Changes:
- The steps of the main agent leave the panel.
- Subagents follow the order in which they started, not the step that started them, and auto-scroll follows the latest subagent.
- The panel no longer follows turns (lines 73, 84-85). It shows only the subagents that run now, with no ended mark and no "no turn yet" state.
- The panel and its button in the session header are called "Subagents" instead of "Turn Panel".
- Each subagent shows as a full-width row instead of a card, with the same fields and the same click (lines 77, 89).
- A group shows one below the other, joined by a mark on the left, not side by side (line 82; the request calls it REQ-37). A nested subagent shows indented under its parent (line 83).
- Every other requirement of the reference stays true: subagent fields and the subagent conversation (lines 77-81, 88-90, 92).

## Summary

The panel, now called "Subagents", shows only the subagents that run now, whatever turn started them, one full-width row each. Nesting shows as an indent, and a group as rows joined by a mark on the left.

## Requirements

### Functional

- The panel must show no message of the main conversation: no user message, no text of Claude, no tool call of the main agent.
- The panel must list every subagent that runs now, whatever turn started it, from top to bottom in start order, and must show nothing about turns.
- A subagent must leave the panel as soon as it ends, finished or stopped.
- A group of subagents that run at the same time must take the place of its first subagent in that order.
- Each subagent must take its own row, as wide as the panel minus the indent of its level.
- A subagent started by another subagent must appear under its parent, indented by one level, in start order among its siblings.
- The subagents of a group must appear one below the other, joined on the left by a mark at their nesting level.
- The subagents nested under a member of a group must not look like members of that group.
- A group with only one subagent still running must have no mark.
- The panel must never need horizontal scrolling, also with three levels of nesting.
- The panel must keep the latest started subagent visible, unless the user scrolled up.
- When no subagent runs, the panel must show "No subagents running."
- Every label that names the panel must read "Subagents" instead of "Turn Panel", the button in the session header included.
- Every new text must be in English, like the rest of the UI.

## Assumptions

- This is an evolution, not a fix. The panel does what `session_activity.md` asked, and now the requirement changes. The `session_activity` cycle is merged on `main` (PR #44). The orchestrator made this decision as gatekeeper.
- The user message that starts a turn does not show either. The request excludes every message of the main chat, not only Claude's.
- A running subagent whose parent has ended takes the place and the level of that parent.
- A row is one full-width entry per subagent and may take several lines. The seven fields do not fit on one line of a narrow panel.
- A group keeps the definition already in use. This request changes only how a group is drawn.
- The latest text keeps its two-line limit (session_activity.md line 80). The row gives it more width, not more lines.
- An open subagent conversation stays open when its subagent ends. Once the user closes it, the panel cannot reopen it, so reference line 91 no longer holds.

## Scope

In scope:
- The content of the panel: only the subagents that run now, with no main-agent step and nothing about turns.
- Subagents as full-width rows in start order, with auto-scroll, nesting by indent and groups joined by a mark on the left.
- The name "Subagents" for the panel and its button in the session header.

Out of scope:
- The steps of the main agent in the panel. The terminal of a hosted session and the conversation of an external session already show them.
- The list entry: latest text, step time, stall signal and running-tool line stay as they are.
- The place, width and open/close action of the panel, the fields of a subagent, the subagent conversation, and any history of ended subagents.
