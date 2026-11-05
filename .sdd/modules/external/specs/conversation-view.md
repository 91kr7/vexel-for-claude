---
module: external
component: ConversationView
type: UI component
---

# ConversationView

**Purpose** → shows the conversation of an external session read-only, as the `main` of board "Sessione esterna", and keeps it current.

## Contract

Description:
- a SessionHeader above a rounded content panel, 12 px apart. Together they fill the open-session area.
- the panel: radius 28 px, `--sc-low`. Its content scrolls inside it with padding 28 px 24 px 80 px. The entries sit in a centred column of at most 760 px, 16 px apart.

Props:
- `sessionId` → the id of the external session.
- `session` → `{ folder, label, state }` for the header. Optional.
- `onResumed(id)` → called with the id of the hosted session after "Riprendi qui" succeeds.

Shows:
- the SessionHeader with `session` and `external`: the outlined terminal Avatar, the folder name, the state chip, then the chip "Sola lettura" (lock icon, `.label-l`, 1 px `--outline-variant` border, `--on-surface-variant` text). The line is "Aperta in un altro terminale · <folder>", with the full path. The action is ResumeHereButton.
- before the first frame of ConversationStreamRoute → a ProgressIndicator "Caricamento…".
- first frame with no items → "Nessun messaggio."
- the socket closes before the first frame → an ErrorMessage "Conversazione non disponibile."
- one `article` per entry, in the order received:
  - `user` item → a bubble on the right (`aria-label` "Utente"): at most 80 % of the column plus its 12 px 16 px padding, radius 20 20 4 20 px, `--primary` with `--on-primary` text. The text in `.body-l`; under it, aligned right, the time in `.body-s` at 80 % opacity. No time when the item has no valid `timestamp`.
  - `assistant` item → on the left (`aria-label` "Claude"): the ember spark (28 px, `--ember`), 12 px gap, the text in `.body-l` 2 px lower. Text between single backticks on one line shows without the backticks as a mono chip: 14 px, padding 1 px 6 px, radius 6 px, `--sc-high`.
  - tool card → see "Tool cards".
- user and Claude text keeps its line breaks.

Message time (`formatMessageTime(iso, now)`, exported):

```
iso not a valid date          → ""
same calendar day as now      → "HH:MM"
any other day                 → "DD/MM/YYYY HH:MM"
```

Tool cards:
- a `tool_call` and the first later `tool_result` whose `toolUseId` equals its `id` form one card, at the place of the call. A `tool_result` with no such call is a card of its own, with the wrench icon and the name "Risultato".
- the card (`aria-label` "Strumento: <name>"): 40 px from the left, radius 16 px, `--sc-lowest`, 1 px `--outline-variant` border. Two cards in a row are 6 px apart.
- its row is one button (`aria-expanded`), padding 10 px 12 px 10 px 16 px, 12 px gaps: the tool icon in `--on-surface-variant`, the name in `.label-l`, the summary in mono `.body-m` and `--on-surface-variant` (one line, cut with an ellipsis, full text as tooltip), the outcome chip, the chevron.
- tool icon: `Bash` → terminal. `Edit`, `Write`, `MultiEdit`, `NotebookEdit` → pencil. Any other → wrench.
- outcome chip (`.label-m`, 24 px high):
  - no result yet → no chip.
  - result with `isError` → "Fallito" with the circle-x icon, `--error-container` / `--on-error-container`.
  - any other result → "Fatto" with the check icon, `--ok-container` / `--on-ok-container`.
- closed (default) → chevron right, nothing below the row.
- open → chevron down. Below the row, one mono `.body-s` block on `--sc`, padding 12 px 16 px 14 px 48 px, 1 px `--outline-variant` line on top. It holds, in this order, separated by an empty line:
  - the full input, when the call has `moreInput`. It comes from ItemContentRoute.
  - the output: the full text from ItemContentRoute when the result is `truncated`; otherwise its text. Before the full text is loaded, the cut text and a last line "…".
- an open card with nothing to show in the block shows no block.

Actions:
- each new frame adds its items. A result joins its card even when it arrives in a later frame.
- opening a card loads, the first time, the full input (when `moreInput`) and the full output (when `truncated`). Only parts with a `ref` are loaded.
  - while a part loads → a ProgressIndicator "Caricamento…" under the block.
  - a load fails → an ErrorMessage "Impossibile caricare il contenuto completo." under the block. The next open tries that part again.
  - a part already loaded is never requested again.
- a card is open when its result arrives → the full output loads at once when it is `truncated`.

Scrolling:
- the view is at the end when its bottom is within 8 px of the end of the content.
- the first frame always shows the last entry.
- new entries arrive while the view is at the end → the content scrolls to the last entry.
- new entries arrive while the user has scrolled up → the view does not move, and N grows by the number of new entries. A result that joins an existing card adds nothing.
- N > 0 → a button at the bottom centre of the panel, 20 px from its bottom, floating over the content: `.btn` `.label-l`, `--primary-container` / `--on-primary-container`, a light shadow, arrow-down icon. Text "N nuovi messaggi", or "1 nuovo messaggio".
- click on the button → the content scrolls to the end, the button disappears and N goes back to 0.
- the user scrolls to the end → the button disappears and N goes back to 0.

## Rules and invariants

- It has no input field. It sends nothing on the socket.
- It opens one socket per `sessionId` and closes it on unmount.
- The header stays in place. Only the panel content scrolls; the panel and the button do not.
- It requests the full content of a part only when the user opens its card.
- Only the colour roles of ThemeTokens are used.

## Dependencies

- ConversationStreamRoute, ItemContentRoute, ResumeHereButton
- SessionHeader (module sessions)
- IconSet, ProgressIndicator, ErrorMessage, ThemeTokens, WebEntry (module app)

## Requirements served

- `plan-claude_sessions_client/REQ-33`, `plan-claude_sessions_client/REQ-34`, `plan-claude_sessions_client/REQ-36`
- `plan-claude_sessions_client-ui_redesign/REQ-17`, `plan-claude_sessions_client-ui_redesign/REQ-19`, `plan-claude_sessions_client-ui_redesign/REQ-20`, `plan-claude_sessions_client-ui_redesign/REQ-21`, `plan-claude_sessions_client-ui_redesign/REQ-22`, `plan-claude_sessions_client-ui_redesign/REQ-23`, `plan-claude_sessions_client-ui_redesign/REQ-24`, `plan-claude_sessions_client-ui_redesign/REQ-4`, `plan-claude_sessions_client-ui_redesign/REQ-29`, `plan-claude_sessions_client-ui_redesign/REQ-30`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-35`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-36`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-37`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-38`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-39`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-40`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-41`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-42`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-43`
