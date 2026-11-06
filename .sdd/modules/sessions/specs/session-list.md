---
module: sessions
component: SessionList
type: UI component
---

# SessionList

**Purpose** → the grouped entries of every hosted and external session, as compact rows of `#quick-session-list` in `.sdd/mockups/studio-dark/mock.html` (`.vx-session-row`, built by `renderSidebarQuickList()`).

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
- the groups of `groupSessions` with `order`, in its order. Each group is a level-2 heading with the group title in `.section-label` (all muted, padding 0 × 6 px), 4 px above a list with one item per session. Rows are 2 px apart.

Entry row (every entry but the hosted needs-input card): a button with the class `session-entry`, the `.vx-session-row` look.
- padding 6 × 8 px, 6 px radius, 12/18 px text in `--text-secondary`. Hover → `--bg-surface-2` and `--text-primary`.
- line 1, 8 px gaps → the StateBadge `dot` (8 px), the folder name (`folderNameOf`, tooltip: the full folder path), then on the right the StateBadge `inline` (mono 10 px in the state colour).
- line 2, 2 px below and 16 px in from the left → the label (11/16 px, `--text-muted`, tooltip: the full label), then on the right the context percentage, then the estimated cost, then the RelativeTime of the last activity (mono 10 px, `--text-muted`).
- context percentage → only when the summary has `usage.context`: "<percent>%" by `percentOf`, mono 10 px, 6 px before the time. Colour by `usageLevelOf`: `normal` in `--text-muted` (`--text-secondary` when open), `warning` in amber-400, `error` in rose-400. No `usage.context` → nothing, never "0%". Every state shows it, ended included.
- estimated cost → only when the summary has `usage.cost`: the text of `costText(usage.cost.usd)`, e.g. "$1.27", "<$0.01", or "—" when there is no `usd`. Mono 10 px in `--text-muted` (`--text-secondary` when open).
  - with the percentage it reads "23% · $1.27": the "·" is hidden from assistive technology. Without the percentage, only "$1.27".
  - tooltip of the amount: "Estimated cost at API list prices".
  - `usage.cost.incomplete` → an amber-400 "*" right after the amount, with the tooltip and the accessible name "Incomplete: the price of a model is unknown".
  - no `usage.cost` → nothing, never "$0.00". Every state shows it, ended included.
- tool line, only for a `working` entry whose summary has `runningTool` → line 3, 2 px below line 2 and 16 px in: "<name>: <argument>", or "<name>" when there is no argument, then "+<others>" when `others` > 0. Mono 10/15 px, weight 400, `--text-muted` (`--text-secondary` when open). The text is cut with an ellipsis; "+<others>" always stays visible. Tooltip: the whole line. No tool line in any other state.
- a hosted working entry → a ProgressBar 2 px below its last line, 16 px in. An external entry never shows it.
- folder name and label longer than the row are cut on one line with an ellipsis. A row with its two lines is 48 px high. A tool line makes it taller.
- at every list panel width from 180 to 480 px, each line stays on one row inside the entry. The context percentage and the cost are never cut. When they still do not fit:
  - line 2 → after the label, the time is cut with an ellipsis.
  - line 1 → after the folder name, the state name is cut with an ellipsis.

Entry variants:

| Entry | Classes | Look |
|-------|---------|------|
| open (`aria-current="true"`) | — | `--accent-glow` background, `--text-primary`, weight 600, 2 px `--accent-primary` bar on the left (padding left 6 px); label and time in `--text-secondary` |
| ended | `ended` | text in `--text-muted` also on hover; zinc dot. Open → `--text-secondary` |
| external | `external` | 1 px dashed `--border-strong` border all around (padding 5 × 7 px). Open → the dashed border stays and the accent bar is drawn inside it |
| ended hosted | `ended` | plus EndedEntryActions beside the entry button: "Dismiss" always, "Resume" only when the summary has `resumable: true` |
| external, `needs_input` | `external needs-input` | dashed row with the amber dot; the chip "External" (`.mono-chip` on surface 2) after the folder name; "Permission for **<tool>**" in mono amber-300 in place of the label when `waitingTool` is known; no "Reply" |

Hosted needs-input card (look of `#permission-banner`): a block with the class `session-card`.
- `.vx-surface-2`, 1 px amber-500 border at 40 %, 12 px radius, padding 14 px, `shadow-lg`. Items 4 px apart.
- top → a button with the classes `session-entry needs-input`: the tag "Needs Input" (mono 10 px uppercase, weight 500, amber-300 on amber-500 at 20 %, amber-500 border at 40 %, 4 px radius) and the folder name (12 px weight 500, `--text-primary`); below, the label as in a row, with the context percentage and the estimated cost of a row at its right.
- then the needs-input line → "Permission for **<tool>** · <time>", with the tool in bold. With no `waitingTool`, the label takes the place of "Permission for <tool>". `<time>` is the RelativeTime of the last activity. Look of `#perm-cmd`: mono 12/16 px, amber-300, `--bg-canvas`, `--border-subtle` border, 4 px radius, padding 6 × 10 px, one line cut with an ellipsis.
- then, 12 px below and on the right, "Reply" → `.button-primary` in mono weight 500, padding 6 × 14 px, scaled to 95 % while pressed.
- the card button is described by the needs-input line (`aria-describedby`).
- the open card has `aria-current="true"` on its button, the accent glow over its background and the 2 px accent bar inside its left edge.

"Rename" (every entry, rows and the needs-input card):
- a 20 px square icon button (pencil icon, 14 px, `--text-muted` on `--bg-surface-2`, 4 px radius), with the accessible name and the tooltip "Rename". It sits beside the entry button, not inside it, after the EndedEntryActions in the tab order.
- place → top right of the row, over its state name; top right inside the needs-input card. On an ended hosted row, EndedEntryActions move to its left.
- hidden (opacity 0) until the pointer is over the entry or the focus inside the entry is visible from the keyboard. Hover → `--bg-surface-3` and `--text-primary`. The focused button shows the focus ring.
- pressed → the entry shows SessionNameEditor in place of its label (row line 2, or the card label). Only one entry edits at a time. The other parts of the entry stay.
- during the edit → the entry is no longer a button: a click on it opens nothing and it cannot be dragged. "Rename" is hidden.
- the edit ends with Enter or Esc → the label comes back and the focus goes to "Rename". It ends with a blur → the label comes back and the focus stays where the user put it.

Actions:
- click on an entry row → `onOpen(id)`. Ended and external sessions too.
- click anywhere on the hosted needs-input card → `onOpen(id)`, once.
- "Reply" → `onOpen(id)`, once.
- "Resume" and "Dismiss" of an ended hosted entry → EndedEntryActions. A resume calls `onResumed(id)` with the new session id. They do not call `onOpen`.
- "Rename" → opens the name editor of the entry (above). It does not call `onOpen` or `onReorder`.
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

Drag feedback (the mock has no drag state):
- while the pointer is over an entry of the own group → a 2 px `--accent-primary` line, as wide as the entries, in the 2 px gap at the landing place: above the entry for "before", below it for "after".
- the dragged entry → dimmed to 40 % opacity while it is in the own group.
- no line over another group, over the gap between groups, or outside the list.
- drop, end of the drag, or the session leaving its own group → the line and the dimming disappear.

## Rules and invariants

- No entry text wraps.
- Only `working` entries show a tool line.
- Only the open session's button has `aria-current="true"`.
- Only the entries of ended hosted sessions show "Dismiss" or "Resume". Working, needs-input, idle and external entries show neither.
- Every entry, hosted or external, in any state, has "Rename".
- Renaming never moves an entry: the order comes from `order` and the last activity, not from the label.
- The needs-input entries are the most visible of the list: amber, first group.
- An external entry is told apart without colour: the dashed border, and the "External" chip when it needs input.
- The state of an entry is readable without colour: its name is always shown.

## Assumptions

- Progress bar on hosted entries only (gatekeeper decision of the previous plan).
- The state name sits on line 1 and the time on line 2, so the folder name keeps more width in a narrow panel.

## Dependencies

- groupSessions, SessionOrderStore (`SessionOrder`), usage format (`percentOf`, `usageLevelOf`, `costText`, `INCOMPLETE_COST_TEXT`), StateBadge, RelativeTime, ProgressBar, Avatar (`folderNameOf`), EndedEntryActions, SessionNameEditor
- AreaState, IconSet, ThemeTokens, WebEntry (module app)

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
