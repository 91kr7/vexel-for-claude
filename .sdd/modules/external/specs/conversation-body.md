---
module: external
component: ConversationBody
type: UI component
---

# ConversationBody

**Purpose** → the read-only message list of a conversation, kept current from a stream of items. ConversationView shows an external session with it, SubagentConversation (module activity) a subagent.

## Contract

Description:
- a scrolling message area that fills its container. The entries sit in a centred column of at most 896 px, with 24 px padding, 16 px apart.

Props:
- `streamPath` → the path of the WebSocket that sends the items, in the frames of ConversationStreamRoute. The body opens it on the host of the page, with `wss:` on an `https:` page and `ws:` otherwise.
- `contentPath` → the path that gives the full content of one item, in the answers of ItemContentRoute. The body adds `?offset=<n>&block=<n>` of the item's `ref`.
- `userName` → optional, the name of the user items. Default "You".
- `userAvatar` → optional, the letter of the user avatar. Default "U".
- `focusRef` → optional. Gets `{ focus() }`: puts the keyboard focus in the message area, which then shows the focus ring inside its edge. The message area is not in the Tab order.

Shows:
- before the first frame → an AreaState `loading` "Loading…".
- first frame with no items → an AreaState `empty` "No messages.".
- the socket closes before the first frame → an AreaState `error` "Conversation not available." (rose tile).
- one `article` per entry, in the order received:
  - `user` item (`aria-label` = `userName`) and `assistant` item (`aria-label` "Claude") → both on the left. A 24 px avatar 2 px lower, 12 px gap, then:
    - the name line, 8 px gap → `userName` or "Claude" (12/16 px, weight 600); for a user item with a valid `timestamp`, the time (mono 10 px, `--text-muted`).
    - the text, 14 px, line height 1.625, `--text-primary`. A user text sits in a `.vx-surface-2` box with a `--role-border-strong` border, `--radius-card` and 12 px padding, 4 px under the name line. A Claude text is 10 px under the name line, with no box.
  - user avatar → the neutral square of Avatar with `userAvatar`. Claude avatar → a 24 px square, 6 px radius, `--accent-primary` fill, "✦" in mono 11 px and `--on-accent`. Both decorative.
  - in Claude text, text between single backticks on one line shows without the backticks as a mono chip: 12 px, padding 2 × 6 px, the pill shape (`--radius-pill`, `--role-raised`, `--border-pill`).
  - tool card → see "Tool cards".
- user and Claude text keeps its line breaks.

Message time (`formatMessageTime(iso, now)`, exported):

```
iso not a valid date          → ""
same calendar day as now      → "HH:MM"
any other day                 → "DD/MM/YYYY HH:MM"
```

Tool cards (look of the tool card built by `selectSession()`):
- a `tool_call` and the first later `tool_result` whose `toolUseId` equals its `id` form one card, at the place of the call. A `tool_result` with no such call is a card of its own, named "Result".
- the card (`aria-label` "Tool: <name>"): 36 px from the left, so it lines up with the message text. surface-1 fill through `--role-chrome`, so it stays apart from the surface-2 user box, 1 px `--role-border-subtle` border, `--radius-card`; the row turns `--role-hover` on hover. Two cards in a row are 8 px apart.
- its row is one button (`aria-expanded`), padding 6 × 12 px, 8 px gaps, mono 11 px; surface 2 on hover:
  - the name chip → padding 0 × 6 px, `--radius-pill`, `--role-card-active`, `--role-accent`, weight 500.
  - the summary → `--text-primary`, one line cut with an ellipsis, full text as tooltip.
  - the outcome, 8 px after, mono 10 px: no result yet → "▾" alone in `--text-muted`; result with `isError` → "Error ▾" in rose-400; any other result → "Completed ▾" in emerald-400. "▾" is decorative.
- no tool icon.
- closed (default) → "▾" turned to point right, nothing below the row.
- open → "▾" points down. Below the row, one block on `--tool-output-bg` with a 1 px `--tool-output-line` line on top, padding 8 × 12 px, mono 12 px (`--term-size`), line height 1.625, `--tool-output-text`. In Light that is white, dark slate text and a thin grey line; in the other themes the canvas, secondary text and the subtle border. It holds, in this order, separated by an empty line:
  - the full input, when the call has `moreInput`. It comes from `contentPath`.
  - the output: the full text from `contentPath` when the result is `truncated`; otherwise its text. Before the full text is loaded, the cut text and a last line "…".
- an open card with nothing to show in the block shows no block.

Actions:
- each new frame adds its items. A result joins its card even when it arrives in a later frame.
- opening a card loads, the first time, the full input (when `moreInput`) and the full output (when `truncated`). Only parts with a `ref` are loaded.
  - while a part loads → a ProgressIndicator "Loading…" under the block.
  - a load fails → an ErrorMessage "Could not load the full content." under the block. The next open tries that part again.
  - a part already loaded is never requested again.
- a card is open when its result arrives → the full output loads at once when it is `truncated`.

Reconnection:
- the socket closes after the first frame, not by unmount → the body opens a new socket 2 s later, and again every 2 s while the attempts fail.
- the first frame of a new socket replaces all the items. No entry shows twice. For "N new messages", only the entries beyond the previous count are new.
- an attempt closed with `4404` → no more attempts. The items stay.
- no error shows after the first frame, during the attempts or after them.
- a socket that closes before the first frame of the body → the error AreaState above, and no attempt.

Scrolling:
- the body is at the end when its bottom is within 8 px of the end of the content.
- the first frame always shows the last entry.
- new entries arrive while the body is at the end → the content scrolls to the last entry.
- new entries arrive while the user has scrolled up → the body does not move, and N grows by the number of new entries. A result that joins an existing card adds nothing.
- N > 0 → a `.vx-glass` button at the bottom centre of the message area, 20 px from its bottom, floating over the content: `--radius-frame`, `--shadow-frame`, padding 8 × 14 px, mono 12 px, arrow-down icon at 14 px. Text "N new messages", or "1 new message".
- click on the button → the content scrolls to the end, the button disappears and N goes back to 0.
- the user scrolls to the end → the button disappears and N goes back to 0.

## Rules and invariants

- It has no input field. It sends nothing on the socket.
- It has one socket open at a time. A new `streamPath` closes it and opens one on the new path. Unmount closes it and ends the attempts.
- Only the messages scroll; the "N new messages" button does not.
- It requests the full content of a part only when the user opens its card.

## Dependencies

- ConversationStreamRoute and ItemContentRoute, or routes with the same frames and answers (SubagentConversationRoute, SubagentItemContentRoute of module activity)
- AreaState, IconSet, ProgressIndicator, ErrorMessage, ThemeTokens, WebEntry (module app)

## Requirements served

- the conversation requirements of ConversationView, for an external session
- `plan-session_activity/REQ-50`, `plan-session_activity/REQ-51`
