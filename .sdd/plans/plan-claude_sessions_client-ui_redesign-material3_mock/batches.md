---
slug: claude_sessions_client-ui_redesign-material3_mock
date: 2026-11-05
status: validated
---

# Batches — Restyle of the client to the "Vexel for Claude" Material 3 mock

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [colours-type](batches/batch-colours-type.md) | Colours and type | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5 | — | certified | The user sees light-blue accents, grey surfaces and the Roboto fonts |
| [page-frame](batches/batch-page-frame.md) | Page frame | REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15 | colours-type | certified | The user opens a waiting session from the snackbar |
| [session-list](batches/batch-session-list.md) | Session list | REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28 | page-frame | implemented | The user answers a waiting session from its card |
| [hosted-session](batches/batch-hosted-session.md) | Hosted session | REQ-29, REQ-30, REQ-31, REQ-32, REQ-33, REQ-34 | session-list | todo | The user works in a hosted session laid out as the board |
| [external-session](batches/batch-external-session.md) | External session | REQ-35, REQ-36, REQ-37, REQ-38, REQ-39, REQ-40, REQ-41, REQ-42, REQ-43 | hosted-session | todo | The user reads an external session laid out as the board |
| [dialogs](batches/batch-dialogs.md) | Dialogs | REQ-44, REQ-45, REQ-46, REQ-47, REQ-48, REQ-49, REQ-50, REQ-51, REQ-52 | session-list | todo | The user picks a recent folder for a new session |

Execution order: colours-type → page-frame → session-list → hosted-session → external-session. dialogs needs only session-list, so it can run at any point after it.

## Visual reference

The four boards in `.sdd/mockups/vexel-material3/` bind every UI batch. Each batch file names the board files it reproduces. It also gives the developer the human's instruction: "the result must be IDENTICAL to the mock board — open the board file and copy its layout, sizes, radii, spacing, typography, icons and texts; a description is not a substitute".

## Assumptions and decisions

Gatekeeper decisions, taken at requirements validation. These are not human decisions.

- **G1. Hosted terminal.** The rounded terminal panel and the hint row under it fill the main area below the header. `plan-claude_sessions_client-ui_redesign/REQ-18` is read this way. Source: `proposta-sessione-ospitata.html`.
- **G2. Snackbar.** One snackbar at a time. It shows the session that most recently started to need input, and it replaces the previous one.
- **G3. Rail "Sessioni".** It always looks selected. A click moves the focus to the list.
- **G4. "Recenti".** Each folder appears once, most recent first, with no maximum. The list scrolls inside the dialog. Each row looks like the radio rows of the board.
- **G5. Lightness check (REQ-4).** CIELAB L* within ±2.
- **G6. Tool call with no result yet.** The card shows no outcome chip until the result arrives.
- **G7. "Apri" (REQ-14).** It opens that session.

Gatekeeper decision, taken at coverage validation.

- **G8. External sessions that need input (REQ-17, REQ-25).** Today the scanner gives an external session only `working` or `idle`. Claude Code 2.1.318 writes `status` `waiting`, with a `waitingFor` field, when the session waits for the user. Its other known values are `busy`, `shell` and `idle`. The scanner maps `waiting` to `needs_input`. The other values keep today's mapping. Source: the strings of the installed CLI binary, and a live session file. The risk raised at planning is resolved. See `batch-session-list.md`, INT-11.

Planner decisions:

- **Palette.** Light blue = a sky-blue hue, about 205° in HSL. Neutral grey = CIELAB a* and b* within ±2. The violet-tinted roles are the primary family, the secondary container, the surfaces, the outlines, the inverse colours and the terminal colours. Teal, tertiary, error, amber, green and ember keep the mock values.
- **Colour role names.** The client takes the role names of the boards (`--primary`, `--sc-low`, `--attn`, …). The old token names point to the new roles until no component uses them. See `batch-colours-type.md`.
- **Fonts and icons come from the repository.** The Roboto files are copied from the mock folder. The OFL text comes from the licence file the client already ships. Icon paths are copied from the boards, which use Lucide drawings. No download and no new package is needed, so every batch uses only the commands in `.sdd/.archi`.
- **Waiting tool (REQ-22).** The tracker keeps the tool name of the permission request. When it is unknown, the line shows the label (spec assumption).
- **Snackbar trigger.** Only a change seen after the first list load counts. Sessions that already need input on page load show in the list and the badge, not in a snackbar.
- **External entry in "In altri terminali".** No "Esterna" tag, as in "Sessione ospitata", which wins for the list panel. The state icon shows, because REQ-19 and REQ-20 ask for it.
- **Open entry that needs input.** It stays the amber card, with a 2 px outline in `--primary`. This keeps `plan-claude_sessions_client-ui_redesign/REQ-16` true without the old left bar.
- **Paths are shown in full.** "~/…" in the boards is sample data. The path field keeps an absolute path, so starting a session works as before.
- **The folder browser stays.** It sits below "Recenti" under the heading "Cartelle", with rows drawn like the "Recenti" rows (spec: an existing feature stays, drawn with the mock's parts).
- **Tool cards.** A tool call and its result form one card. Icon: Bash → terminal, Edit, Write, MultiEdit and NotebookEdit → pencil, any other tool → wrench. An open card shows the output, and above it the full input when the input has more than the main argument. So the old full-input expand stays.
- **"N nuovi messaggi".** N counts the items that arrived while the user read earlier content. A tool card counts as one.
- **Times.** List and needs-input line → "ora", "N min fa", clock time, date (spec assumption). They refresh every 30 s. User bubbles → clock time `HH:MM`, with the date before it on earlier days.
- **"Matches the board" REQs (REQ-28, REQ-34, REQ-43, REQ-52).** They also depend on the parts that earlier batches build. The batch dependencies make sure those parts are in place.
- **Components that earlier batches build** are cited by name in later batches, for example the Avatar of `session-list` in `dialogs`. Their paths are in the indexes once their batch is done.

## Departures

None.

## Coverage check

Each INT is cited as `batch/INT-n`. Batch abbreviations: `ct` = colours-type, `pf` = page-frame, `sl` = session-list, `hs` = hosted-session, `es` = external-session, `dl` = dialogs.

| REQ | Served by | Closes in |
|-----|-----------|-----------|
| REQ-1 | ct/INT-1, ct/INT-2, ct/INT-5, ct/INT-7 | colours-type |
| REQ-2 | ct/INT-1, ct/INT-2, ct/INT-6, ct/INT-7 | colours-type |
| REQ-3 | ct/INT-1, ct/INT-2 | colours-type |
| REQ-4 | ct/INT-1 | colours-type |
| REQ-5 | ct/INT-3, ct/INT-4, ct/INT-5, ct/INT-6, ct/INT-7 | colours-type |
| REQ-6 | pf/INT-1, pf/INT-3 | page-frame |
| REQ-7 | pf/INT-2 | page-frame |
| REQ-8 | pf/INT-2 | page-frame |
| REQ-9 | pf/INT-1, pf/INT-4 | page-frame |
| REQ-10 | pf/INT-3 | page-frame |
| REQ-11 | pf/INT-3, pf/INT-4 | page-frame |
| REQ-12 | pf/INT-5 | page-frame |
| REQ-13 | pf/INT-6, pf/INT-7 | page-frame |
| REQ-14 | pf/INT-7 | page-frame |
| REQ-15 | pf/INT-6 | page-frame |
| REQ-16 | sl/INT-4, sl/INT-7 | session-list |
| REQ-17 | sl/INT-4, sl/INT-11 | session-list |
| REQ-18 | sl/INT-4 | session-list |
| REQ-19 | sl/INT-1, sl/INT-2, sl/INT-7 | session-list |
| REQ-20 | sl/INT-5, sl/INT-6 | session-list |
| REQ-21 | sl/INT-3, sl/INT-7 | session-list |
| REQ-22 | sl/INT-2, sl/INT-9, sl/INT-10 | session-list |
| REQ-23 | sl/INT-9 | session-list |
| REQ-24 | sl/INT-1, sl/INT-8 | session-list |
| REQ-25 | sl/INT-9, sl/INT-11 | session-list |
| REQ-26 | sl/INT-8 | session-list |
| REQ-27 | sl/INT-8 | session-list |
| REQ-28 | sl/INT-1, sl/INT-3, sl/INT-5, sl/INT-7, sl/INT-8, sl/INT-9 | session-list |
| REQ-29 | hs/INT-1, hs/INT-2, hs/INT-4 | hosted-session |
| REQ-30 | hs/INT-3 | hosted-session |
| REQ-31 | hs/INT-3, hs/INT-4 | hosted-session |
| REQ-32 | hs/INT-5 | hosted-session |
| REQ-33 | hs/INT-6 | hosted-session |
| REQ-34 | hs/INT-1, hs/INT-2, hs/INT-3, hs/INT-4, hs/INT-5, hs/INT-6 | hosted-session |
| REQ-35 | es/INT-2, es/INT-3 | external-session |
| REQ-36 | es/INT-1, es/INT-4 | external-session |
| REQ-37 | es/INT-4, es/INT-10 | external-session |
| REQ-38 | es/INT-5 | external-session |
| REQ-39 | es/INT-6, es/INT-7, es/INT-10 | external-session |
| REQ-40 | es/INT-1, es/INT-8, es/INT-10 | external-session |
| REQ-41 | es/INT-9, es/INT-10 | external-session |
| REQ-42 | es/INT-9 | external-session |
| REQ-43 | es/INT-2, es/INT-3, es/INT-4, es/INT-5, es/INT-6, es/INT-7, es/INT-8, es/INT-9 | external-session |
| REQ-44 | dl/INT-1, dl/INT-5, dl/INT-8, dl/INT-10 | dialogs |
| REQ-45 | dl/INT-6 | dialogs |
| REQ-46 | dl/INT-7 | dialogs |
| REQ-47 | dl/INT-2, dl/INT-3 | dialogs |
| REQ-48 | dl/INT-2, dl/INT-3 | dialogs |
| REQ-49 | dl/INT-1, dl/INT-9 | dialogs |
| REQ-50 | dl/INT-2, dl/INT-4 | dialogs |
| REQ-51 | dl/INT-1, dl/INT-2 | dialogs |
| REQ-52 | dl/INT-1, dl/INT-2, dl/INT-3, dl/INT-5, dl/INT-6 | dialogs |

- Every REQ is served by at least one INT.
- Every INT serves at least one REQ. There is no enabling INT.
- Each REQ closes in the batch of its feature. REQ-34 and REQ-43 also rely on the rail, the list panel and the entries of page-frame and session-list (see "Assumptions and decisions").
