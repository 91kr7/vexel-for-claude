---
module: sessions
component: SessionList
type: UI component
---

# SessionList

**Purpose** → the grouped entries of every hosted and external session, as the section "Elenco sessioni" of board "Sessione ospitata" and the variants of board "Voci dell'elenco".

## Contract

Description:
- a vertical, scrolling column inside the list panel of AppLayout. It holds headings and entries, 4 px apart. It is not a landmark: the list panel carries the label "Elenco sessioni".

Props:
- `sessions` → the list from LiveSessionStore.
- `openSessionId` → the session shown in the open-session area, or `null`.
- `onOpen(id)` → opens a session.
- `status` → the load status from LiveSessionStore: `loading`, `ready` or `error`. Default `ready`.

Shows:
- `loading` → a ProgressIndicator "Caricamento…" in place of the entries and of "Nessuna sessione.".
- `error` → an ErrorMessage "Connessione al server persa. Ricarica la pagina." above the entries. The entries already received stay.
- `ready`, no session → "Nessuna sessione." With `error` and no session, only the ErrorMessage shows.
- the groups of `groupSessions`, in its order. Each group is a level-2 heading with the group title (`.label-l`), then a list with one item per session.
  - heading margins: 8 px above for the first heading, 16 px for the others; 12 px left and right; 4 px below.
  - heading colour: `--attn` for "Richiedono input", `--on-surface-variant` for the others.

Entry row (every entry but the hosted needs-input card): a button with the class `session-entry`.
- layout: 12 px gap, padding 12 px 16 px, radius 16 px, no border, transparent, `--on-surface` text.
- left → Avatar (`list` size) of the folder, state and external flag.
- middle → the folder name (`folderNameOf`, `.title-m`, tooltip: the full folder path); below it the label (`.body-m`, `--on-surface-variant`, tooltip: the full label). A working entry adds a ProgressBar 6 px under the label.
- right, aligned to the end → StateBadge, and 4 px below it the RelativeTime of the last activity (`.body-s`, `--on-surface-variant`).
- folder name and label longer than the entry are cut on one line with an ellipsis.

Entry variants (board "Voci dell'elenco"):

| Entry | Classes | Look |
|-------|---------|------|
| open (`aria-current="true"`) | — | `--secondary-container` background, `--on-secondary-container` text; the label takes the text colour |
| ended | `ended` | `--on-surface-variant` text; the label takes the text colour; grey Avatar |
| external, `working` or `idle` | `external` | 1 px dashed `--outline-variant` border, outlined Avatar with the terminal icon, no "Esterna" tag |
| external, `needs_input` | `external needs-input` | `--attn-container` background, `--on-attn-container` text, radius 20 px, no border; the tag "Esterna" after the folder name; "Permesso per **<tool>**" in place of the label when `waitingTool` is known; outlined Avatar; no "Rispondi" |

- the tag "Esterna" → `.label-m`, 20 px high, padding 0 6 px, radius 6 px, 1 px `--outline` border, `--on-surface-variant` text, with a 12 px terminal icon before the text.
- an open external entry keeps its dashed border.

Hosted needs-input card (board "Sessione ospitata"): a block with the class `session-card`.
- 10 px gap, padding 14 px 16 px, radius 20 px, `--attn-container` background, `--on-attn-container` text.
- top → a button with the classes `session-entry needs-input`: amber Avatar, folder name, label in the card text colour, and on the right the StateBadge "Richiede input".
- bottom → the needs-input line (`.body-s`) and, at the end, the button "Rispondi" (`.btn .label-l`, 32 px high, padding 0 14 px, `--attn` background, `--sc-lowest` text).
- needs-input line → "Permesso per **<tool>** · <time>", with the tool in bold. With no `waitingTool`, the label takes the place of "Permesso per <tool>". `<time>` is the RelativeTime of the last activity.
- the card button is described by the needs-input line (`aria-describedby`).
- the open card has `aria-current="true"` on its button and a 2 px `--primary` outline around the card.

Actions:
- click on an entry row → `onOpen(id)`. Ended and external sessions too.
- click anywhere on the hosted needs-input card → `onOpen(id)`, once.
- "Rispondi" → `onOpen(id)`, once.
- hover on an entry or card → an 8 % layer of the text colour over its background.

## Rules and invariants

- No entry text wraps.
- Only the open session's button has `aria-current="true"`.
- The needs-input entries are the most visible of the list: amber, first group.
- An external entry is told apart without colour: the dashed border or the "Esterna" tag, and the terminal avatar.

## Dependencies

- groupSessions, StateBadge, Avatar, RelativeTime, ProgressBar
- IconSet, ProgressIndicator, ErrorMessage (module app)

## Requirements served

- `plan-claude_sessions_client/REQ-11`, `plan-claude_sessions_client/REQ-12`, `plan-claude_sessions_client/REQ-16`, `plan-claude_sessions_client/REQ-22`, `plan-claude_sessions_client/REQ-29`, `plan-claude_sessions_client/REQ-30`
- `plan-claude_sessions_client-ui_redesign/REQ-11`, `plan-claude_sessions_client-ui_redesign/REQ-12`, `plan-claude_sessions_client-ui_redesign/REQ-13`, `plan-claude_sessions_client-ui_redesign/REQ-15`, `plan-claude_sessions_client-ui_redesign/REQ-16`, `plan-claude_sessions_client-ui_redesign/REQ-29`, `plan-claude_sessions_client-ui_redesign/REQ-30`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-16` to `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-28`
