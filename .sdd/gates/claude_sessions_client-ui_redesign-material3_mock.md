# Gates — claude_sessions_client-ui_redesign-material3_mock

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-05 | analysis | mock input | decided | Bundle unreadable as is: "Proposta — *" boards extracted to `.sdd/mockups/vexel-material3/` with latin fonts and README; human asked that the mock be passed on |
| 2026-11-05 | analysis | fix or evolution | decided | Evolution of `claude_sessions_client-ui_redesign.md`: it left the style open on purpose; human away and delegated every answer |
| 2026-11-05 | analysis | size check | pass | ordinary, 146 lines of 200 |
| 2026-11-05 | analysis | G1 analysis | pass | Added elements (rail, snackbar, Interrompi, Recenti, nuovi messaggi, focus on Annulla) trace to the boards; palette light blue + grey from the request |
| 2026-11-05 | plan | question planner Q1 terminal area | decided | Panel + hint fill the main area below the header; old `plan-claude_sessions_client-ui_redesign` REQ-18 read that way; source board `proposta-sessione-ospitata.html` |
| 2026-11-05 | plan | question planner Q2 snackbar | decided | One snackbar at a time, the latest session that started needing input replaces the previous; touches less |
| 2026-11-05 | plan | question planner Q3 rail Sessioni | decided | Always selected; click moves focus to the list |
| 2026-11-05 | plan | question planner Q4 Recenti | decided | Unique folders, most recent first, no cap, scrolls inside the dialog |
| 2026-11-05 | plan | question planner Q5 lightness | decided | CIELAB L* within ±2 accepted |
| 2026-11-05 | plan | question planner Q6 pending tool call | decided | No outcome chip until the result arrives; the board shows only Fatto |
| 2026-11-05 | plan | question planner Q7 REQ-14 | decided | Confirmed: snackbar action "Apri" opens the session; source analysis, snackbar requirement |
| 2026-11-05 | plan | G2 requirements | pass | All analysis requirements covered by REQ-1..52 and the batch constraints |
| 2026-11-05 | plan | planner risk external needs input | decided | Claude Code 2.1.318 writes session-file `status` `waiting` (with `waitingFor`) while waiting for the user; INT-11 of `batch-session-list.md` maps it to `needs_input`; source CLI binary strings |
| 2026-11-05 | plan | G3 coverage | pass | All REQs served, batches per feature, modify paths exist, Human acceptance present, IDENTICAL instruction and board files in every batch |
| 2026-11-05 | dev | G4 colours-type | pass | Build green re-run; diff limited to INT-1..7 files, specs, index |
| 2026-11-05 | dev | divergence colours-type tertiary | decided | Pink tertiary roles left out: no board uses them, human asked for blue/grey |
| 2026-11-05 | dev | divergence colours-type Inter files | decided | Unused `src/web/fonts/inter*` kept: deleting files from an earlier cycle is not asked by any convention; flagged for human review |
| 2026-11-05 | dev | divergence colours-type font tokens | decided | `--font-ui`/`--font-mono` in `tokens.css` instead of `styles.css`; same result, follows existing idiom |
| 2026-11-05 | test | G5 colours-type round 1 | sent back | Red: `src/web/fonts/inter*` still tracked, breaks ThirdPartyNotices/BundledFont; INT-3 "replace Inter" asks their removal, so the earlier "keep" decision is reversed |
| 2026-11-05 | test | G5 colours-type round 2 | pass | 70 e2e + 60 unit green, re-run by gatekeeper |
| 2026-11-05 | dev | G4 page-frame | pass | Build green re-run; diff limited to INT-1..7 files, specs, indexes |
| 2026-11-05 | dev | divergence page-frame snackbar position | decided | Floats bottom-right of main until hosted-session INT-6 places it in the hint row; no pty resize |
| 2026-11-05 | dev | divergence page-frame list landmark | decided | List root no longer `nav`: board labels the panel `section` "Elenco sessioni"; avoids duplicate landmark |
| 2026-11-05 | dev | divergence page-frame counter at zero | decided | REQ-11 (newer) hides the chip at zero; the empty status element stays |
| 2026-11-05 | test | G5 page-frame round 1 | sent back | Red: `e2e/session-entries.spec.ts:337` external entry 1.16 px taller (old plan REQ-11); code defect, line with the Esterna mark |
| 2026-11-05 | test | G5 page-frame round 2 | pass | Re-run by gatekeeper: 54 e2e + 117 unit green; `e2e/layout.spec.ts:334` failed once under parallel load, passed alone and on full re-run (flaky, watch at closing) |
| 2026-11-05 | dev | G4 session-list | pass | Build green re-run; diff limited to INT-1..11 files, specs, index |
| 2026-11-05 | dev | conflict old REQ-11 equal entry layout | decided | Board wins: entries differ in height (card, bar, dashed border); human asked to follow the mock to the letter. For human review |
| 2026-11-05 | dev | conflict old REQ-12 colour per state | decided | Board wins: only "Lavora" coloured, states told apart by icon + text, needs input bold, ended dimmed. For human review |
| 2026-11-05 | dev | divergence session-list needs-input card | decided | State badge added (REQ-19/20); whole card clickable to keep "click opens any entry" |
| 2026-11-05 | dev | divergence session-list external needs input | decided | Amber row with "Esterna", no dashed border: `proposta-voci-elenco.html` wins for that state |
| 2026-11-05 | test | question tester progress bar on external | decided | Board wins (REQ-28, human "alla lettera"): no bar on external working entries; REQ-21 read as hosted entries. For human review |
| 2026-11-05 | test | question tester layout.spec.ts:301 race | decided | Fix the test race now, before the plan's closing run |
| 2026-11-05 | test | G5 session-list round 1 | sent back | Code change from the progress-bar decision; then re-test |
| 2026-11-05 | test | G5 session-list round 2 | sent back | Tester race fix hung on absent chip (`boundingBox` waits); diagnosis sent to tester |
| 2026-11-05 | test | G5 session-list round 3 | pass | Re-run by gatekeeper: 23 e2e + 416 unit green |
| 2026-11-05 | dev | G4 hosted-session | pass | Build green re-run; `src/web/AppLayout.tsx` outside INTs justified by INT-6 (snackbar into the hint row) |
| 2026-11-05 | dev | foreign change package.json | decided | `start` port 4001→4004 changed outside the cycle during the run; not committed, not reverted; for human review |
| 2026-11-05 | dev | divergence hosted-session hint row | decided | Fixed 48 px row, no wrap (G1, no pty resize); panel min-height 0 instead of 560 px; same at 1440x900 |
| 2026-11-05 | dev | divergence hosted-session folder path | decided | Absolute path shown; "~/" in the board is sample data (plan decision "paths are shown in full") |
| 2026-11-05 | test | G5 hosted-session round 1 | sent back | Tester expects 42 px Interrompi; board is a `button`, border-box by UA default, so 40 px total is the board value; test fixed by tester |
| 2026-11-05 | test | G5 hosted-session round 2 | pass | Re-run by gatekeeper: 53 e2e green; unit 84 green by tester |
