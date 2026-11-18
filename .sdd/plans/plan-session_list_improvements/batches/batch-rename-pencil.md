---
batch: rename-pencil
feature: Rename pencil position
closed_req: [REQ-40, REQ-41, REQ-42, REQ-43]
depends: [rename]
---

# Batch rename-pencil — Rename pencil position

REQ ids refer to `plan-session_list_improvements/requirements.md`. "Label row" is defined there: the second row of an entry. This batch is a fix of batch `rename`. It builds no new component.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/sessions/SessionList.tsx` | Make the place of "Rename" follow the label row of a row (`EntryRow`) and of the needs-input card (`NeedsInputCard`), not a fixed top offset. The pencil stays a sibling of the entry button, with the same DOM order, so the Tab order does not change. Anchoring it to the label row, as the star does with its slot, is allowed. | REQ-40, REQ-41, REQ-43 | — |
| INT-2 | modify | `src/web/styles.css` | `.entry-rename` and its needs-input card rule → label row, right end, `right: 10px`. The label row keeps room on its right, always, so the label is cut with an ellipsis before the pencil. Remove the 20 px right padding of line 1 of the card, which only made room for the pencil. | REQ-40, REQ-41, REQ-42, REQ-43 | INT-1 |
| INT-3 | modify | `src/web/styles.css` | Remove the rule `.session-list li:has(> .entry-rename:not([hidden])) .ended-entry-actions { right: 32px }`. EndedEntryActions keep the top right corner of the first row, at `right: 10px`. | REQ-40, REQ-41 | INT-2 |

## Decisions

- **Label row (gatekeeper decision).** "The row of the session name" of the spec is row 2, the label row. The star and the folder name stay on row 1. In an external entry that needs input, row 2 shows the permission text, and the pencil sits there too.
- **Ended actions (gatekeeper decision).** "Dismiss" and "Resume" keep the first row and its top right corner, as in commit f856169. It is an intervention (INT-3) and a scenario, not a REQ.
- **Earlier attempt.** Commit f856169 "Move the session rename button to the label line" lives only on the local branch `feat/card_metrics_spacing`. It was never released. It moved the pencil with a fixed `top: 31px` and `padding-right: 24px` on the label row. This is the human's intent. Do not copy the fixed offset: it breaks when the label row has another height. Anchor to the row when the existing pattern allows it.
- **Room before the pencil.** The room is reserved on the label row at all times, not only on hover. The label then never changes its cut when the pencil appears (REQ-42). The pencil is hidden during an edit and the name editor takes the whole row, as today.
- **Nothing else changes (REQ-43).** Look (20 px, pencil 14 px), opacity 0 until hover or visible keyboard focus, hover colours, focus ring, Tab order, the editor and the `rename` shortcut stay as in batch `rename`.
- **Specs.** The implementer updates the "Rename" place in `.sdd/modules/sessions/specs/session-list.md` (lines 75, 82) and the SessionList line of `.sdd/modules/sessions/index.md`: "top-right corner" becomes "right end of the label row"; EndedEntryActions keep the top right corner of the first row.
- **Old tests to update.** They encode the old corner (`plan-ui_restyle` REQ-31, replaced by REQ-40 to REQ-42):
  - `e2e/favorite-session.spec.ts` → the helper at line 603 and the tests at lines 629, 645 and 746 ("top-right corner holds only Rename", `rename.y - outer.y < 16`, the star left of "Rename"). They now check the label row, no overlap with the label, and that the star and the folder name stay on the first row.
  - `src/web/sessions/SessionList-rename.test.tsx` and `src/web/sessions/SessionList-favorite.test.tsx` → any check of the corner or of the room left on line 1.
  - `e2e/rename.spec.ts` and `e2e/session-entries.spec.ts` → check that no check depends on the old position.
- **Tests (knowledge base `electron-e2e-separate`, `narrow-batch-tests`).** Web files only, so no Electron e2e. Vitest for the DOM and Tab order. Playwright e2e in the browser for the geometry: bounding boxes of the pencil, the label row, the star and the ended actions. Run the files above, not the full suite.

## Human acceptance

### Scenario: The pencil sits on the label row of a row

- REQ → REQ-40, REQ-43
- Given → a hosted session is in the list, its entry shows the folder name on the first row and the label on the second
- When → the user moves the pointer over the entry
- Then → the pencil "Rename" shows at the right end of the second row, level with the label, and nothing shows at the right end of the first row

### Scenario: The pencil sits on the label row of the needs-input card

- REQ → REQ-41
- Given → a hosted session needs input, and its card shows the folder name and the star on the first row
- When → the user moves the pointer over the card
- Then → the pencil "Rename" shows at the right end of the label row, under the star row

### Scenario: A long label is cut before the pencil

- REQ → REQ-42
- Given → a session with a very long label, in a row and in a needs-input card, in a list panel 180 px wide
- When → the user moves the pointer over each entry
- Then → the label ends with an ellipsis before the pencil, and the pencil covers neither the label nor the star

### Scenario: An ended row keeps Dismiss and Resume in its corner

- REQ → REQ-40, REQ-43
- Given → an ended hosted session with a saved conversation is in the list
- When → the user moves the pointer over its entry
- Then → "Resume" and "Dismiss" show at the top right corner of the first row, with no gap beside them for a pencil
- And → "Rename" shows on the second row, at its right end, and does not overlap them

### Scenario: The pencil keeps its look and its behaviour

- REQ → REQ-43
- Given → a session entry and a keyboard user
- When → the user presses Tab until "Rename" has the focus, presses Enter, types "Release fix" and presses Enter again
- Then → the pencil showed with its focus ring, the editor opened in place of the label, and the entry shows "Release fix" in its place

### Scenario: An external session needing input

- REQ → REQ-40
- Given → an external session needs input, and its entry shows "Permission for <tool>" on the second row
- When → the user moves the pointer over the entry
- Then → the pencil shows at the right end of that second row
