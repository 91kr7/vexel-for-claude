---
request_slug: session_list_improvements
date: 2026-11-06
type: evolution
size: ordinary
reference: .sdd/analysis/claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order.md
---

# Analysis — Session list: dismiss and resume, running tool, rename

## Request

> Miglioramenti dell'elenco sessioni, tre punti. 1) Le sessioni finite restano nell'elenco per sempre: il client non le toglie mai e l'utente non ha modo di toglierle. Sulla sessione ospitata finita servono due azioni: "Dismiss", che la toglie dall'elenco, e "Resume", che la riprende con un clic come si fa dalla cronologia. 2) Tool in esecuzione nell'elenco: per una sessione che sta lavorando, la voce dell'elenco mostra il tool che Claude sta eseguendo in quel momento, ad esempio "Bash: npm test". 3) Rinomina della sessione: l'utente può dare un nome a una sessione, che sostituisce l'etichetta presa dall'inizio del primo prompt.

## Reference

[claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order.md](claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order.md) → the latest analysis of the session list. Entries keep a fixed place inside their state group. The user reorders them with drag and drop. Other analyses set the base rules:
- Each entry's label is the start of the first user message ([claude_sessions_client.md](claude_sessions_client.md), line 48).
- Ended sessions go to their own group, dimmed ([claude_sessions_client-ui_redesign-material3_mock.md](claude_sessions_client-ui_redesign-material3_mock.md), lines 59-68).
- Past sessions are resumed from the history dialog ([claude_sessions_client.md](claude_sessions_client.md), line 74).

Changes:
- An ended hosted session gets the actions "Dismiss" and "Resume" on its list entry.
- A working entry shows the tool that Claude runs at that moment.
- The user can give any session a name, which replaces its label.
- Every other requirement of the reference stays true.

## Summary

Three changes to the session list. The user can dismiss or resume an ended hosted session from its entry. A working entry shows the running tool. The user can give a session a name that replaces its label.

## Requirements

### Functional

Dismiss and Resume
- The entry of an ended hosted session must offer the actions "Dismiss" and "Resume".
- No other entry must offer these two actions.
- "Dismiss" must remove the session from the list at once, with no confirmation.
- A dismissed session must not come back to the list after a page reload or a restart of the client.
- A dismissed session must stay in the resume history and stay resumable from there and from the terminal.
- When the dismissed session is open, the main area must return to its state with no open session.
- "Resume" must resume the session with one click, with no dialog, as a resume from the history does.
- "Resume" must still show the running-elsewhere warning when the session runs in another terminal.
- After "Resume", the resumed session must be open in the main area.
- After "Resume", the list must hold one entry for that conversation, in its new state group. The ended entry must not remain beside it.
- "Resume" must be offered only when the session has a saved conversation. Without one, the entry offers only "Dismiss".
- When "Resume" fails, the entry must stay in the ended group and the user must see an error message.

Running tool
- The entry of a working session, hosted or external, must show the tool that Claude runs at that moment.
- The tool line must show the tool name and its main argument, for example "Bash: npm test".
- The main argument must be the same one that the tool-call cards of the conversation view show.
- A tool with no main argument must show its name only.
- A main argument longer than the entry must be cut on one line with an ellipsis. A command on several lines must show its first line.
- When several tools run at the same time, the line must show the last one that started and the count of the others, for example "+2".
- The line must show only the tool calls of the main conversation, not the tool calls inside a subagent.
- A tool must stay shown for at least 1 second, unless another tool replaces it or the turn ends.
- When no tool runs, the entry must show no tool line.
- The tool line must not appear on entries that need input, are idle or have ended.

Rename
- The user must be able to give a name to any session in the list, hosted or external, in any state, from its list entry.
- The name must replace the label wherever the client shows that session's label. These places are the list entry, the session header, the stop confirmation, notifications, the tray menu and the resume history.
- The history search must match the name in place of the default label.
- An empty name, or a name of spaces only, must bring back the default label.
- The client must remove spaces at the start and end of a name, and must refuse a name longer than 200 characters.
- Enter must confirm the name and Esc must cancel the change.
- The name must survive a page reload, a client restart and a Resume of the session.
- A new name must appear in every open page and in the desktop app without a reload.
- Renaming must not change the place of the session in the list.
- Every new text must be in English, like the rest of the UI.

### Non-functional

- The tool line must update within 2 seconds of the tool start, for hosted and external sessions.
- Rename, Dismiss and Resume must be usable with the keyboard, with visible focus, as the reference requires for the UI.

## Assumptions

- This is an evolution, not a fix. None of the earlier analyses asked for these behaviours. The orchestrator decided this.
- The name lives only in the client. It never becomes the Claude Code session name, and the terminal does not see it. The orchestrator decided this. Setting the Claude Code name would need `/rename` typed into the session's terminal, which interferes with a running turn. Writing to Claude Code files is forbidden ([claude_sessions_client.md](claude_sessions_client.md), line 94).
- External sessions can get a client name, because the name writes nothing to the session ([claude_sessions_client.md](claude_sessions_client.md), line 69).
- Dismiss and Resume sit on the list entry only, because the request is about the list.
- The client does not remove ended sessions by itself. The request asks for user actions only.
- A resumed session moves to the end of its new group, per the order rules of the reference.
- The 200-character limit matches the limit of Claude Code session names ([Claude Code commands](https://code.claude.com/docs/en/commands)).
- The 1-second minimum keeps fast tools from making the line blink.

## Risks

- For external sessions, the running tool comes from internal Claude Code files. A late or missed write shows a stale tool or none.
- A command line can contain secrets, such as a token in a `curl` call. The list now shows them without opening the session, for example during screen sharing.
- If Resume starts a session under a new id, the old entry and the new one can both stay in the list.

## Scope

In scope:
- "Dismiss" and "Resume" on ended hosted sessions in the list.
- The running tool on working entries, for hosted and external sessions.
- A client-only name for hosted and external sessions, shown wherever the label appears.

Out of scope:
- Dismiss or Resume for external sessions.
- Automatic removal of ended sessions, removing several at once, and undo of a dismiss.
- New actions in the header of an open session.
- Setting or reading Claude Code session names, including names set with `/rename` in a terminal.
- Tool history or tool details beyond the current tool.
- Any change to the state groups, their order, or drag and drop.
