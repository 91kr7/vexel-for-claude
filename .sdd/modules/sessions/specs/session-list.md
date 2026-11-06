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

Shows:
- `loading` → a compact AreaState `loading` "Loading…" in place of the entries.
- `error` → a compact AreaState `error` "Connection to the server lost. Reload the page." (rose tile) above the entries. The entries already received stay.
- `ready`, no session → a compact AreaState `empty` "No sessions.". With `error` and no session, only the error block shows.
- the groups of `groupSessions`, in its order. Each group is a level-2 heading with the group title in `.section-label` (all muted, padding 0 × 6 px), 4 px above a list with one item per session. Rows are 2 px apart.

Entry row (every entry but the hosted needs-input card): a button with the class `session-entry`, the `.vx-session-row` look.
- padding 6 × 8 px, 6 px radius, 12/18 px text in `--text-secondary`. Hover → `--bg-surface-2` and `--text-primary`.
- line 1, 8 px gaps → the StateBadge `dot` (8 px), the folder name (`folderNameOf`, tooltip: the full folder path), then on the right the StateBadge `inline` (mono 10 px in the state colour).
- line 2, 2 px below and 16 px in from the left → the label (11/16 px, `--text-muted`, tooltip: the full label), then on the right the RelativeTime of the last activity (mono 10 px, `--text-muted`).
- a hosted working entry → a ProgressBar 2 px below line 2, 16 px in. An external entry never shows it.
- folder name and label longer than the row are cut on one line with an ellipsis. A row with its two lines is 48 px high.

Entry variants:

| Entry | Classes | Look |
|-------|---------|------|
| open (`aria-current="true"`) | — | `--accent-glow` background, `--text-primary`, weight 600, 2 px `--accent-primary` bar on the left (padding left 6 px); label and time in `--text-secondary` |
| ended | `ended` | text in `--text-muted` also on hover; zinc dot. Open → `--text-secondary` |
| external | `external` | 1 px dashed `--border-strong` border all around (padding 5 × 7 px). Open → the dashed border stays and the accent bar is drawn inside it |
| external, `needs_input` | `external needs-input` | dashed row with the amber dot; the chip "External" (`.mono-chip` on surface 2) after the folder name; "Permission for **<tool>**" in mono amber-300 in place of the label when `waitingTool` is known; no "Reply" |

Hosted needs-input card (look of `#permission-banner`): a block with the class `session-card`.
- `.vx-surface-2`, 1 px amber-500 border at 40 %, 12 px radius, padding 14 px, `shadow-lg`. Items 4 px apart.
- top → a button with the classes `session-entry needs-input`: the tag "Needs Input" (mono 10 px uppercase, weight 500, amber-300 on amber-500 at 20 %, amber-500 border at 40 %, 4 px radius) and the folder name (12 px weight 500, `--text-primary`); below, the label as in a row.
- then the needs-input line → "Permission for **<tool>** · <time>", with the tool in bold. With no `waitingTool`, the label takes the place of "Permission for <tool>". `<time>` is the RelativeTime of the last activity. Look of `#perm-cmd`: mono 12/16 px, amber-300, `--bg-canvas`, `--border-subtle` border, 4 px radius, padding 6 × 10 px, one line cut with an ellipsis.
- then, 12 px below and on the right, "Reply" → `.button-primary` in mono weight 500, padding 6 × 14 px, scaled to 95 % while pressed.
- the card button is described by the needs-input line (`aria-describedby`).
- the open card has `aria-current="true"` on its button, the accent glow over its background and the 2 px accent bar inside its left edge.

Actions:
- click on an entry row → `onOpen(id)`. Ended and external sessions too.
- click anywhere on the hosted needs-input card → `onOpen(id)`, once.
- "Reply" → `onOpen(id)`, once.

## Rules and invariants

- No entry text wraps.
- Only the open session's button has `aria-current="true"`.
- The needs-input entries are the most visible of the list: amber, first group.
- An external entry is told apart without colour: the dashed border, and the "External" chip when it needs input.
- The state of an entry is readable without colour: its name is always shown.

## Assumptions

- Progress bar on hosted entries only (gatekeeper decision of the previous plan).
- The state name sits on line 1 and the time on line 2, so the folder name keeps more width in the 224 px panel.

## Dependencies

- groupSessions, StateBadge, RelativeTime, ProgressBar, Avatar (`folderNameOf`)
- AreaState, ThemeTokens, WebEntry (module app)

## Requirements served

- `plan-claude_sessions_client/REQ-11`, `plan-claude_sessions_client/REQ-12`, `plan-claude_sessions_client/REQ-16`, `plan-claude_sessions_client/REQ-22`, `plan-claude_sessions_client/REQ-29`, `plan-claude_sessions_client/REQ-30`
- `plan-claude_sessions_client-ui_redesign/REQ-11`, `plan-claude_sessions_client-ui_redesign/REQ-12`, `plan-claude_sessions_client-ui_redesign/REQ-13`, `plan-claude_sessions_client-ui_redesign/REQ-15`, `plan-claude_sessions_client-ui_redesign/REQ-16`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-11`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-12`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-23` to `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-29`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-50`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-3`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-5`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-15`
