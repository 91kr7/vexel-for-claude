---
batch: session-list
feature: Session list
closed_req: [REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28]
depends: [page-frame]
---

# Batch — Session list

The groups and the entries of the session list, in the list panel that batch `page-frame` built.

Constraint → every requirement of `plan-claude_sessions_client` and `plan-claude_sessions_client-ui_redesign` stays true. This includes live updates, a click that opens any entry (ended ones too) and the needs-input entry that stands out most.

## Visual reference

Board files:
- `.sdd/mockups/vexel-material3/proposta-sessione-ospitata.html` → `section aria-label="Elenco sessioni"`: the group headings, the amber needs-input card, the open entry, the working entry and the external entry. This board wins for the list panel and the needs-input entry.
- `.sdd/mockups/vexel-material3/proposta-voci-elenco.html` → every entry variant, in light and dark. The `items` array of its script holds the exact style of each variant (row, avatar, state). It wins for the states that only it shows: the ended entry.

## What this batch builds

- **Avatar** → the round or square badge with the project initials, or the terminal icon of an external session. Header and dialogs reuse it.
- **Relative time** → the text "ora", "N min fa", clock time or date for a time of last activity.
- **Progress bar** → the thin animated, indeterminate bar of a working entry.
- To the developer: the result must be IDENTICAL to the mock board — open the board file and copy its layout, sizes, radii, spacing, typography, icons and texts; a description is not a substitute. Boards: `proposta-sessione-ospitata.html` and `proposta-voci-elenco.html`.

## Decisions for this batch

- **Initials** → the first letters of the first two words of the folder name. Words split on "-", "_" and spaces. A single word gives its first two letters. Upper case.
- **Avatar variant** → stable per folder, chosen from the mock variants: `--primary-container` round (20 px radius) and `--teal-container` square (12 px radius). Amber square (`--attn`) for needs input. Grey round (`--sc-highest`) for ended. Outlined round with the terminal icon for external. Sizes: 40 px in the list, 48 px in the header, 36 px in dialog rows.
- **Groups** → "Richiedono input", "In corso", "In altri terminali", "Terminate". Headings as in "Sessione ospitata": `.label-l`, amber for "Richiedono input", `--on-surface-variant` for the others. Inside a group, the latest activity comes first.
- **State icons** → "Lavora" = loader circle, "In attesa" = circle pause, "Richiede input" = circle alert, "Terminata" = circle minus. Paths from `proposta-voci-elenco.html`.
- **Needs-input line** → "Permesso per **<strumento>** · <tempo>". With no known tool, the label replaces "Permesso per <strumento>". <tempo> is the relative time of the last activity.
- **External entries** → in "In altri terminali": dashed border and outlined avatar, no "Esterna" tag ("Sessione ospitata" wins). In "Richiedono input": the amber card with the "Esterna" tag of `proposta-voci-elenco.html`, no "Rispondi". The state icon always shows. The old "Esterna" tooltip, which said the needs-input state is not available, goes away.
- **Open entry** → `--secondary-container` background, as in the board. An open entry that needs input stays the amber card, with a 2 px outline in `--primary`.
- **Ended entry** → dimmed as in `proposta-voci-elenco.html` (`docs-site` item).
- **Times** → "ora" under one minute, "N min fa" under one hour, then `HH:MM`, then the date on earlier days. They refresh every 30 s.
- **External needs input** (gatekeeper decision) → Claude Code 2.1.318 writes `status` in `<claudeDir>/sessions/<pid>.json`. Its known values are `busy`, `shell`, `idle` and `waiting`. It writes `waiting`, with a `waitingFor` field, when the session waits for the user. Source: the strings of the installed CLI binary, and a live session file with `"status":"busy"`. No live check is needed. See INT-11.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | frontend, sessions area | Avatar: initials, stable variant per folder, amber for needs input, grey for ended, outlined terminal icon for external, three sizes. IDENTICAL to the board avatars. | REQ-19, REQ-24, REQ-28 | — |
| INT-2 | create | frontend, sessions area | Relative time: "ora", "N min fa", `HH:MM`, date. It refreshes every 30 s. | REQ-19, REQ-22 | — |
| INT-3 | create | frontend, sessions area | Progress bar: 4 px, animated and indeterminate, `--primary` on `--primary-container`. IDENTICAL size and radius to the board bar. | REQ-21, REQ-28 | — |
| INT-4 | modify | `src/web/sessions/session-order.ts` | Return the four groups in order, with no empty group. Inside each group, the latest activity comes first. | REQ-16, REQ-17, REQ-18 | — |
| INT-5 | modify | `src/web/sessions/StateBadge.tsx` | Texts "Lavora", "In attesa", "Richiede input", "Terminata", with the board icons, `.label-m`, 14 px icon and the board colours. | REQ-20, REQ-28 | INT-6 |
| INT-6 | modify | `src/web/icons/Icons.tsx` | Add the circle-minus icon, with the path copied from `proposta-voci-elenco.html`. | REQ-20 | — |
| INT-7 | modify | `src/web/sessions/SessionList.tsx` | Group headings and entry rows as the board: avatar, folder name (`.title-m`), label, state, time, and the bar under the label of a working entry. IDENTICAL to the boards. | REQ-16, REQ-19, REQ-21, REQ-28 | INT-1, INT-2, INT-3, INT-4, INT-5 |
| INT-8 | modify | `src/web/sessions/SessionList.tsx` | Open entry on `--secondary-container`. Dimmed ended entry. External entry with dashed border and outlined avatar. IDENTICAL to the board variants. | REQ-24, REQ-26, REQ-27, REQ-28 | INT-7 |
| INT-9 | modify | `src/web/sessions/SessionList.tsx` | Needs-input amber card: the needs-input line and "Rispondi", which opens the session. External card: "Esterna" tag, no "Rispondi". IDENTICAL to the board card. | REQ-22, REQ-23, REQ-25, REQ-28 | INT-7 |
| INT-10 | modify | `src/server/sessions/session-state-tracker.ts` | The summary gets the waiting tool: `tool_name` of `PermissionRequest`, or of the last `PreToolUse` before a `permission_prompt`. It is cleared when the state leaves `needs_input`. The field reaches the page through the existing routes. | REQ-22 | — |
| INT-11 | modify | `src/server/external/external-session-scanner.ts` | Map the session-file `status` `waiting` to `needs_input`. Other values keep today's mapping: `busy` → `working`, any other value or none → `idle`. | REQ-17, REQ-25 | — |

## Human acceptance

### Scenario: The user answers a waiting session from its card

- REQ → REQ-16, REQ-17, REQ-19, REQ-20, REQ-22, REQ-23
- Given → hosted session "web-dashboard" waits for permission to use Bash, and session "billing-api" is open
- When → the user clicks "Rispondi" on the amber card "web-dashboard" under "Richiedono input"
- Then → "web-dashboard" opens
- And → before the click, the card read "Permesso per Bash · <tempo>", with the avatar "WD" and the state "Richiede input"

### Scenario: The user tells working, external and ended sessions apart

- REQ → REQ-18, REQ-21, REQ-24, REQ-26, REQ-27, REQ-28
- Given → one hosted session works, one external session works, one session has ended and one session is open
- When → the user compares the list with board "Voci dell'elenco", in each theme
- Then → each entry sits in its group ("In corso", "In altri terminali", "Terminate") and matches its variant in board "Voci dell'elenco", in both themes
- And → the working entry shows a moving bar, the external entry a dashed border, the ended entry is dimmed and the open entry is highlighted

### Scenario: The user sees an external session that waits for input

- REQ → REQ-17, REQ-25
- Given → a session in another terminal waits for a permission
- When → the user looks at the list
- Then → its entry is under "Richiedono input" with the tag "Esterna" and no "Rispondi" button
