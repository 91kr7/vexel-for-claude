---
status: validated
---

# Batches — Session list: dismiss and resume, running tool, rename

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [dismiss-resume](batches/batch-dismiss-resume.md) | Dismiss and Resume | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13 | — | certified | The user resumes an ended session with one click |
| [running-tool](batches/batch-running-tool.md) | Running tool | REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24 | — | certified | A working session shows its running tool |
| [rename](batches/batch-rename.md) | Rename | REQ-25, REQ-26, REQ-27, REQ-28, REQ-29, REQ-30, REQ-31, REQ-32, REQ-33, REQ-34, REQ-35, REQ-36, REQ-37, REQ-38, REQ-39 | dismiss-resume | certified | The user names a session from the list |
| [rename-pencil](batches/batch-rename-pencil.md) | Rename pencil position (fix of 2026-11-18) | REQ-40, REQ-41, REQ-42, REQ-43 | rename | implemented | The pencil sits on the label row of a row |

Execution order: `dismiss-resume`, `running-tool`, `rename`, `rename-pencil`.

## Assumptions and decisions

- **Three batches, one per feature.** `rename` depends on `dismiss-resume`, because REQ-36 includes a resume from the list entry. `running-tool` depends on no other batch. It runs second, because all three batches change `SessionList.tsx` and the server wiring, and running them in order avoids conflicts.
- **Resume gives a new hosted id.** ResumeSessionRoute always starts a new hosted session with a new id (spec risk). The entry Resume route removes the old ended entry in the same call (`batch-dismiss-resume/INT-6`), so the list holds one entry (REQ-11). A name follows the Claude Code session id, not the hosted id (`batch-rename`, "Key of a name").
- **New components.** Each batch names its new components in "What this batch builds". There are eight, all in the sessions area: two routes, the ended entry actions, the running tool rule and monitor, the name store, the rename route, and the name editor.
- **No desktop change.** Notifications and the tray read the `label` the server gives. Tests use Vitest, and no batch plans Electron e2e (knowledge base `electron-e2e-separate`).
- **Client data folder.** The names need a file that survives a restart. It is a new folder, outside `~/.claude` (`batch-rename`, "Data folder").
- Placement details and the look of the new elements are in the "Decisions" section of each batch file.
- **Fix of 2026-11-18: one small batch.** `rename-pencil` fixes the place of "Rename". It depends on `rename`, which is certified and stays as it is. It builds no new component and touches two files (`SessionList.tsx`, `styles.css`).
- **Label row (gatekeeper decision).** "The row of the session name" of the spec is row 2 of an entry, the label row. The code puts the star on row 1, so the spec's assumption that the label and the star share a row does not hold.
- **Ended actions (gatekeeper decision).** "Dismiss" and "Resume" keep the top right corner of row 1, with no 32 px offset. It is `rename-pencil/INT-3` and an acceptance scenario, with no REQ.
- **Earlier attempt (gatekeeper finding).** Commit f856169 (2026-11-17) is on the local branch `feat/card_metrics_spacing` only, never released. It is the human's intent. Its fixed `top: 31px` is not copied: the pencil follows the label row.
- **Supersedes `plan-ui_restyle` REQ-31.** The spec replaces that rule ("the top-right corner keeps only Rename"). This is the spec's own change, so it is not a departure. The old tests that encode it are listed in the batch "Decisions".

## Departures

None. No human decision contradicts the spec.

## Coverage check

Every REQ is served by at least one INT, and closes in the batch that serves it.

| REQ | INT | Closes in |
|-----|-----|-----------|
| REQ-1 | `batch-dismiss-resume/INT-9` | dismiss-resume |
| REQ-2 | `batch-dismiss-resume/INT-2`, `INT-9` | dismiss-resume |
| REQ-3 | `batch-dismiss-resume/INT-4`, `INT-9` | dismiss-resume |
| REQ-4 | `batch-dismiss-resume/INT-1`, `INT-3`, `INT-4`, `INT-7`, `INT-8` | dismiss-resume |
| REQ-5 | `batch-dismiss-resume/INT-1`, `INT-4` | dismiss-resume |
| REQ-6 | `batch-dismiss-resume/INT-1` | dismiss-resume |
| REQ-7 | `batch-dismiss-resume/INT-10` | dismiss-resume |
| REQ-8 | `batch-dismiss-resume/INT-5`, `INT-6`, `INT-7`, `INT-8` | dismiss-resume |
| REQ-9 | `batch-dismiss-resume/INT-6`, `INT-8` | dismiss-resume |
| REQ-10 | `batch-dismiss-resume/INT-10` | dismiss-resume |
| REQ-11 | `batch-dismiss-resume/INT-6` | dismiss-resume |
| REQ-12 | `batch-dismiss-resume/INT-6`, `INT-8` | dismiss-resume |
| REQ-13 | `batch-dismiss-resume/INT-8`, `INT-9` | dismiss-resume |
| REQ-14 | `batch-running-tool/INT-3`, `INT-5`, `INT-6`, `INT-7`, `INT-8` | running-tool |
| REQ-15 | `batch-running-tool/INT-1`, `INT-2`, `INT-8` | running-tool |
| REQ-16 | `batch-running-tool/INT-1`, `INT-2`, `INT-8` | running-tool |
| REQ-17 | `batch-running-tool/INT-8` | running-tool |
| REQ-18 | `batch-running-tool/INT-2` | running-tool |
| REQ-19 | `batch-running-tool/INT-2`, `INT-8` | running-tool |
| REQ-20 | `batch-running-tool/INT-3` | running-tool |
| REQ-21 | `batch-running-tool/INT-4` | running-tool |
| REQ-22 | `batch-running-tool/INT-3`, `INT-4`, `INT-8` | running-tool |
| REQ-23 | `batch-running-tool/INT-8` | running-tool |
| REQ-24 | `batch-running-tool/INT-3`, `INT-6` | running-tool |
| REQ-25 | `batch-rename/INT-4`, `INT-6`, `INT-7`, `INT-10` | rename |
| REQ-26 | `batch-rename/INT-2` | rename |
| REQ-27 | `batch-rename/INT-2`, `INT-4` | rename |
| REQ-28 | `batch-rename/INT-2`, `INT-4` | rename |
| REQ-29 | `batch-rename/INT-5` | rename |
| REQ-30 | `batch-rename/INT-5` | rename |
| REQ-31 | `batch-rename/INT-1`, `INT-6`, `INT-9` | rename |
| REQ-32 | `batch-rename/INT-1`, `INT-6`, `INT-9` | rename |
| REQ-33 | `batch-rename/INT-1`, `INT-6`, `INT-9` | rename |
| REQ-34 | `batch-rename/INT-9` | rename |
| REQ-35 | `batch-rename/INT-1`, `INT-7` | rename |
| REQ-36 | `batch-rename/INT-2`, `INT-3` | rename |
| REQ-37 | `batch-rename/INT-2`, `INT-4` | rename |
| REQ-38 | `batch-rename/INT-10` | rename |
| REQ-39 | `batch-rename/INT-9`, `INT-10` | rename |
| REQ-40 | `batch-rename-pencil/INT-1`, `INT-2`, `INT-3` | rename-pencil |
| REQ-41 | `batch-rename-pencil/INT-1`, `INT-2`, `INT-3` | rename-pencil |
| REQ-42 | `batch-rename-pencil/INT-2` | rename-pencil |
| REQ-43 | `batch-rename-pencil/INT-1`, `INT-2`, `INT-3` | rename-pencil |

Every INT serves at least one REQ, except one enabling intervention: `batch-rename/INT-8` keeps the e2e server away from the user's names folder.
