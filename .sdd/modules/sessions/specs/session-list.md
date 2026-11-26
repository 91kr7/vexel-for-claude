---
module: sessions
component: SessionList
type: UI component
---

# SessionList

**Purpose** → the grouped entries of every hosted and external session, as the session cards of `#sessionList` in `.sdd/mockups/dark_blue_theme/mock.html` (built by `renderSessionList()`).

## Contract

Description:
- a vertical, scrolling column inside the list panel of AppLayout, 10 px between its blocks. It is not a landmark: the list panel carries the label "Session List".

Props:
- `sessions` → the list from LiveSessionStore.
- `openSessionId` → the session shown in the open-session area, or `null`.
- `onOpen(id)` → opens a session.
- `status` → the load status from LiveSessionStore: `loading`, `ready` or `error`. Default `ready`.
- `order` → the order of the sessions inside each group, from SessionOrderStore. Default: no order, so each group is in latest-activity order.
- `onReorder(sessionId, groupId, index)` → moves a session to place `index` (0-based) of its group, as SessionOrderStore `move`. Optional.
- `onResumed(id)` → a session was resumed from an ended entry; `id` is the new hosted session. Optional.

Shows:
- `loading` → a compact AreaState `loading` "Loading…" in place of the entries.
- `error` → a compact AreaState `error` "Connection to the server lost. Reload the page." (rose tile) above the entries. The entries already received stay.
- `ready`, no session → a compact AreaState `empty` "No sessions.". With `error` and no session, only the error block shows.
- the groups of `groupSessions` with `order`, in its order. Each group is a level-2 heading with the group title in `.section-label` (all muted, padding 0 × 6 px), 4 px above a list with one item per session. Cards are 8 px apart.

Card (every entry): 7 px corners (`--radius-card`), a 1 px border, the "card" role surface (`--role-card`), padding 10 × 12 px plus the room of the 3.5 px accent bar on the left.
- inactive → `--role-border-subtle` border. Hover → the hover surface (`--role-hover`) and the `--role-border-strong` border.
- open (`aria-current="true"`) → `--role-accent` border, a 3.5 px `--role-accent` bar on the left edge, the "active card" surface, the active card shadow (`--shadow-card-active`). Hover changes nothing.

Entry row (every entry but the hosted needs-input card): a button with the class `session-entry`, 12/18 px text in `--text-secondary`, `--text-primary` on hover and when open.
- line 1, 8 px gaps → the StateBadge `dot` (8 px), the folder name (13 px, weight 600, `folderNameOf`, tooltip: the full folder path), the star place, then on the right the StateBadge `inline` name (11 px, weight 500, in the state colour).
- line 2, 4 px below and 16 px in from the left → the label (11.5/16 px, `--text-muted`, `--text-secondary` when open, tooltip: the full label).
- a working entry → its tool line and its progress bar between line 2 and line 3. An entry at work → its latest-text line, between the tool line (or line 2) and the progress bar.
- line 3, 15 px below line 2 (or the tool line, the latest-text line, or the progress bar), 16 px in, with no top border → on the left the context percentage and the estimated cost, 6 px apart; on the right the RelativeTime of the last activity (`--text-muted`, `--text-secondary` when open). It is there also with no usage: then only the time shows.
- percentage and cost → mono 10 px with tabular figures; time → mono 10.5 px with tabular figures. All on a 15 px line.
- context percentage → only when the summary has `usage.context`: "<percent>%" by `percentOf`. Colour by `usageLevelOf`: `normal` in `--text-secondary` (`--role-accent`, weight 600, when open), `warning` in amber-400, `error` in rose-400. No `usage.context` → nothing, never "0%". Every state shows it, ended included.
- estimated cost → only when the summary has `usage.cost`: the text of `costText(usage.cost.usd)`, e.g. "$1.27", "<$0.01", or "—" when there is no `usd`. In `--text-secondary`.
  - with the percentage it reads "23% · $1.27": the "·" is hidden from assistive technology. Without the percentage, only "$1.27".
  - tooltip of the amount: "Estimated cost at API list prices".
  - `usage.cost.incomplete` → an amber-400 "*" right after the amount, with the tooltip and the accessible name "Incomplete: the price of a model is unknown".
  - no `usage.cost` → nothing, never "$0.00". Every state shows it, ended included.
- tool line, only for a `working` entry whose summary has `runningTool` → 2 px below line 2 and 16 px in: "<name>: <argument>", or "<name>" when there is no argument, then "+<others>" when `others` > 0. Mono 10/15 px, weight 400, `--text-muted` (`--text-secondary` when open). The text is cut with an ellipsis; "+<others>" always stays visible. Tooltip: the whole line. No tool line in any other state.
- latest-text line, only for an entry whose summary has `liveActivity.atWork` true and a `liveActivity.latestText`, in a state other than `needs_input` and `ended` → 2 px below the tool line, or below line 2 when there is no tool line, 16 px in:
  - "<subagentType>: " in weight 600 when `latestText.subagentType` is present, then `latestText.text`. 11.5/16 px, `--text-secondary`.
  - then " · " and the ElapsedTime since `latestText.at`, when `at` is present. Mono 10 px with tabular figures, `--text-muted`.
  - the text wraps on two lines at most, cut with an ellipsis at the end of the second line. The time sits after the text, on its last line, and is never cut.
  - no `subagentType` → no prefix. No `at` → no " · " and no time.
  - tooltip: the prefix and the text.
- a hosted working entry → a ProgressBar 6 px below line 2, the tool line or the latest-text line, 16 px in. An external entry never shows it.
- folder name and label longer than the card are cut on one line with an ellipsis.
- at every list panel width from 180 to 480 px, each line stays on one row inside the card, except the latest-text line (two rows at most). The context percentage and the cost are never cut. When they still do not fit:
  - line 3 → after the percentage and the cost, the time is cut with an ellipsis.
  - line 1 → after the folder name, the state name is cut with an ellipsis.

Entry variants:

| Entry | Classes | Look |
|-------|---------|------|
| open (`aria-current="true"`) | — | the open card above; label, tool line and line-3 time in `--text-secondary` |
| ended | `ended` | text in `--text-muted` also on hover; zinc dot. Open → `--text-secondary` |
| external | `external` | the solid 1 px card border of every other card, in every state: inactive, hover, open, ended, needing input. No dashed border |
| ended, hosted or external | `ended` (plus `external`) | plus EndedEntryActions beside the entry button: "Dismiss" always, "Resume" only when the summary has `resumable: true`. An ended external card keeps the solid card border |
| external, `needs_input` | `external needs-input` | card with the amber dot; the chip "External" (`.mono-chip` on surface 2) after the folder name; "Permission for **<tool>**" in mono amber-300 in place of the label when `waitingTool` is known; no "Reply" |

Hosted needs-input card (look of `#permission-banner`): a block with the class `session-card`.
- a card as above, with its amber border kept: 1 px amber-500 border at 40 %, amber-400 on hover. No shadow while closed. Items 4 px apart.
- top → a button with the classes `session-entry needs-input`: the tag "Needs Input" (mono 10 px uppercase, weight 500, amber-300 on amber-500 at 20 %, amber-500 border at 40 %, 4 px radius), the folder name (13 px weight 600, `--text-primary`) and the star place; below, the label as in a row; below, only when the summary has `usage.context` or `usage.cost`, the metrics line with the context percentage and the estimated cost of a row (no top border, no indent, no time).
- then the needs-input line → "Permission for **<tool>** · <time>", with the tool in bold. With no `waitingTool`, the label takes the place of "Permission for <tool>". `<time>` is the RelativeTime of the last activity. Look of `#perm-cmd`: mono 12/16 px, amber-300, `--bg-canvas`, `--border-subtle` border, 4 px radius, padding 6 × 10 px, one line cut with an ellipsis.
- then, 12 px below and on the right, "Reply" → `.button-primary` in mono weight 500, padding 6 × 14 px, scaled to 95 % while pressed.
- the card button is described by the needs-input line (`aria-describedby`).
- the open card has `aria-current="true"` on its button, the "active card" surface, the full 3.5 px accent bar inside its 1 px amber border on the left edge, and the card shadow. Its border stays amber.

Session star (every entry, rows and the needs-input card, in every group):
- FavoriteButton, "Remove Favorite" when the entry has `favorite: true`. It sits right after the folder name on line 1 of a row, and right after the folder name in the needs-input card. It is a sibling of the entry button, never inside it.
- the star place never shrinks, so the folder name is cut first. A row of an external session needing input keeps the "External" chip after it.
- the star stays on line 1 and never meets "Rename", which is on the label row.
- a marked entry shows the filled star always; an unmarked entry shows the outline star only on hover or visible keyboard focus (FavoriteButton). The entry keeps its place and its group.
- Tab order of a row: entry, FavoriteButton, EndedEntryActions, "Rename". Of the needs-input card: entry, FavoriteButton, "Reply", "Rename".
- it is hidden with "Rename" during a rename. Its error shows under the entry; in the needs-input card, at the bottom of the card.

"Rename" (every entry, rows and the needs-input card):
- a 20 px square icon button (pencil icon, 14 px, `--text-muted` on `--bg-surface-2`, 4 px radius), with the accessible name and the tooltip "Rename". It sits beside the entry button, not inside it, after the EndedEntryActions in the tab order.
- place → the right end of the label row (line 2 of the entry), level with the label, in a row and in the needs-input card; never on line 1. The label row always keeps room for it on its right: a longer label is cut with an ellipsis before it. During the edit that room goes to the editor. On an ended row, EndedEntryActions keep the top right corner of line 1, with no gap beside them.
- hidden (opacity 0) until the pointer is over the entry or the focus inside the entry is visible from the keyboard. Hover → `--bg-surface-3` and `--text-primary`. The focused button shows the focus ring.
- pressed → the entry shows SessionNameEditor in place of its label (row line 2, or the card label). Only one entry edits at a time. The other parts of the entry stay.
- during the edit → the entry is no longer a button: a click on it opens nothing and it cannot be dragged. "Rename" is hidden.
- the edit ends with Enter or Esc → the label comes back and the focus goes to "Rename". It ends with a blur → the label comes back and the focus stays where the user put it.

Actions:
- click on an entry row → `onOpen(id)`. Ended and external sessions too.
- click anywhere on the hosted needs-input card → `onOpen(id)`, once.
- "Reply" → `onOpen(id)`, once.
- "Resume" and "Dismiss" of an ended entry, hosted or external → EndedEntryActions. A resume calls `onResumed(id)` with the new session id. They do not call `onOpen`.
- "Mark as Favorite" and "Remove Favorite" → FavoriteButton. They do not call `onOpen` or `onReorder`.
- "Rename" → opens the name editor of the entry (above). It does not call `onOpen` or `onReorder`.
- shortcut command `rename` (ShortcutChannel), only when the list has the entry of `openSessionId` → opens the name editor of that entry, as "Rename" does. The entry scrolls into view and the focus is in the "Session Name" field. When that entry already edits, nothing changes. Another entry that was editing ends its edit.
- EndedEntryActions of an ended entry get `open` → `true` only for the entry of `openSessionId`.
- every entry, row or card, is draggable with the mouse. A click with no drag still opens the session.
- drag over an entry of the dragged session's own group → the upper half of the entry means "before it", the lower half means "after it".
- drop on an entry of the own group → `onReorder(id, group, index)` once. `index` is the place the session takes in the group without it:

```
slot  = index of the entry under the pointer, +1 on its lower half
index = slot - 1  if slot is after the session's current place
        slot      otherwise
```

  A drop on the session's own entry, or on the half next to it, gives its current place.
- drop elsewhere inside the own group (its heading, the gaps between its entries) → the landing place of the line shown, if one shows.
- drop anywhere else (another group, the gap between groups, outside the list) → no `onReorder`.
- the own group is the group of the session when the drag started. If a live update moves the session to another group during the drag, the drag ends for the list: the line and the dimming disappear, also if the session later comes back, and the drop calls no `onReorder`.

Motion (ListCascade, ListPresence, module app):
- first appearance of the entries (the first render after `loading`, or each mount, e.g. when the Sessions view shows) → the entries enter in cascade, in display order, through ListCascade. Focus, clicks and keys work during the cascade.
- after the first appearance, a new entry, hosted or external → slides in from the left (class `is-entering`, `--motion-duration-enter`).
- a removed entry (e.g. "Dismiss") → stays in its place and fades out (class `is-leaving`, `--motion-duration-exit`), then is gone. While it leaves it is inert and hidden from assistive technology: it takes no click, no focus and cannot be dragged. The other entries keep their keys and focus.
- live refreshes, group moves and drag reorders play nothing.
- a dragged entry plays no list effect: its drag dimming shows at once, also during the cascade.
- during the cascade, any change of the shown order or groups (new, removed, moved or reordered entry) ends the cascade at once: every entry shows in full, and a moved entry never plays the cascade again.
- a leaving entry counts for no drag rule: it is not a drop target, it takes no slot or line, and the slot, `index` and the "own group" are computed on the other entries only. A drop during a fade lands where it would land with no effect.
- with reduced motion → no cascade, no slide and no fade: entries show and go at once.

Drag feedback (the mock has no drag state):
- while the pointer is over an entry of the own group → a 2 px `--accent-primary` line, as wide as the entries, in the middle of the 8 px gap at the landing place: above the entry for "before", below it for "after".
- the dragged entry → dimmed to 40 % opacity while it is in the own group.
- no line over another group, over the gap between groups, or outside the list.
- drop, end of the drag, or the session leaving its own group → the line and the dimming disappear.

## Rules and invariants

- No entry text wraps, except the text of the latest-text line.
- No card shows a horizontal divider above line 3.
- The list scrolls with ListStyles `.list-scroll` (module app): a shown scrollbar is as far from the right edge of the cards as the panel edge is from their left edge. The scrollbar stays clear of the resize handle of the panel.
- Only `working` entries show a tool line.
- Only the open session's button has `aria-current="true"`.
- Only the entries of ended sessions, hosted or external, show "Dismiss" or "Resume". Working, needs-input and idle entries, hosted or external, show neither.
- Every entry, hosted or external, in any state, has "Rename".
- Every entry, hosted or external, in any state, has the favorite button.
- Marking or unmarking never moves an entry or changes its group.
- Renaming never moves an entry: the order comes from `order` and the last activity, not from the label.
- The needs-input entries are the most visible of the list: amber, first group.
- An external entry is told apart without colour: its group heading, and the "External" chip when it needs input. Its border is the same as every other card.
- The state of an entry is readable without colour: its name is always shown.
- The existing star pop and status-dot pulse stay as they are.

## Assumptions

- Progress bar on hosted entries only (gatekeeper decision of the previous plan).
- The state name sits on line 1 and the time on line 3, so the folder name keeps more width in a narrow panel.
- The open needs-input card keeps its amber border instead of the accent border: the needs-input entries stay the most visible.

## Dependencies

- groupSessions, SessionOrderStore (`SessionOrder`), usage format (`percentOf`, `usageLevelOf`, `costText`, `INCOMPLETE_COST_TEXT`), StateBadge, RelativeTime, ProgressBar, Avatar (`folderNameOf`), EndedEntryActions, SessionNameEditor, FavoriteButton
- AreaState, ListStyles, IconSet, ShortcutChannel, ThemeTokens, WebEntry, ListCascade, ListPresence (module app)
- ElapsedTime (module activity)

## Requirements served

- `plan-claude_sessions_client/REQ-11`, `plan-claude_sessions_client/REQ-12`, `plan-claude_sessions_client/REQ-16`, `plan-claude_sessions_client/REQ-22`, `plan-claude_sessions_client/REQ-29`, `plan-claude_sessions_client/REQ-30`
- `plan-claude_sessions_client-ui_redesign/REQ-11`, `plan-claude_sessions_client-ui_redesign/REQ-12`, `plan-claude_sessions_client-ui_redesign/REQ-13`, `plan-claude_sessions_client-ui_redesign/REQ-15`, `plan-claude_sessions_client-ui_redesign/REQ-16`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-11`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-12`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-23` to `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-29`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-50`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-3`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-5`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-15`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-6`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-7`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-8`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-10`
- `plan-session_list_improvements/REQ-1`, `plan-session_list_improvements/REQ-2`, `plan-session_list_improvements/REQ-3`, `plan-session_list_improvements/REQ-13`
- `plan-session_list_improvements/REQ-14` to `plan-session_list_improvements/REQ-17`, `plan-session_list_improvements/REQ-19`, `plan-session_list_improvements/REQ-22`, `plan-session_list_improvements/REQ-23`
- `plan-session_list_improvements/REQ-25`, `plan-session_list_improvements/REQ-38`, `plan-session_list_improvements/REQ-39`
- `plan-session_usage/REQ-1`, `plan-session_usage/REQ-8`, `plan-session_usage/REQ-9`, `plan-session_usage/REQ-10`
- `plan-session_usage/REQ-22`, `plan-session_usage/REQ-29`, `plan-session_usage/REQ-30`, `plan-session_usage/REQ-33`, `plan-session_usage/REQ-34`
- `plan-session_list_width/REQ-10`
- `plan-favorite_session/REQ-1`, `plan-favorite_session/REQ-2`, `plan-favorite_session/REQ-3`, `plan-favorite_session/REQ-8`, `plan-favorite_session/REQ-9`, `plan-favorite_session/REQ-13`
- `plan-keyboard_shortcuts/REQ-16`, `plan-keyboard_shortcuts/REQ-17`, `plan-keyboard_shortcuts/REQ-18`
- `plan-wsl_support/REQ-9`, `plan-wsl_support/REQ-10`
- `plan-ui_restyle/REQ-29`, `plan-ui_restyle/REQ-31`, `plan-ui_restyle/REQ-32`
- `plan-dark_blue_theme/REQ-1`, `plan-dark_blue_theme/REQ-2`, `plan-dark_blue_theme/REQ-18` to `plan-dark_blue_theme/REQ-22`, `plan-dark_blue_theme/REQ-43`, `plan-dark_blue_theme/REQ-49`, `plan-dark_blue_theme/REQ-50`, `plan-dark_blue_theme/REQ-53`
- `plan-ui_transitions/REQ-16`, `plan-ui_transitions/REQ-18`, `plan-ui_transitions/REQ-19`, `plan-ui_transitions/REQ-20`, `plan-ui_transitions/REQ-21`, `plan-ui_transitions/REQ-26`
- `plan-session_activity/REQ-2`, `plan-session_activity/REQ-4`, `plan-session_activity/REQ-7`, `plan-session_activity/REQ-8`, `plan-session_activity/REQ-9`, `plan-session_activity/REQ-11`, `plan-session_activity/REQ-13`
