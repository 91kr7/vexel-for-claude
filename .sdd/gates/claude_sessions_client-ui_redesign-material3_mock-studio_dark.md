# Gates — claude_sessions_client-ui_redesign-material3_mock-studio_dark

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-06 | analysis | clarification sequence | human decision | Finish and merge the Material 3 cycle first, then this one from main |
| 2026-11-06 | analysis | clarification theme | human decision | App always dark; light theme removed |
| 2026-11-06 | analysis | clarification accent | human decision | Mock's dark layout with light blue / grey accent, not orange nor carbon-indigo |
| 2026-11-06 | analysis | clarification fonts | human decision | Keep bundled Roboto Flex / Mono; nothing downloaded |
| 2026-11-06 | analysis | clarification batches | human decision | Whole development in a single batch |
| 2026-11-06 | analysis | mock input | decided | `mock.html` copied unchanged to `.sdd/mockups/studio-dark/` |
| 2026-11-06 | analysis | size check | pass | ordinary, 158 lines of 200 |
| 2026-11-06 | analysis | G1 analysis | pass | Extra mock features left out (search, filters, compare, model chip, prompt box); all requirements trace to the mock's dark style or the human's answers |
| 2026-11-06 | analysis | foreign change package.json | decided | Uncommitted `start` port change carried along, never committed; human already informed |
| 2026-11-06 | plan | G2 requirements | pass | REQ-1..53 cover the analysis; only added behaviours REQ-15 and REQ-45, both in the spec |
| 2026-11-06 | plan | G3 coverage | pass | One batch by human decision; 56 INTs, modify paths exist, all 53 REQs in Human acceptance, mock cited in every INT; planner decisions 1-10 follow the mock or contrast (REQ-52) |
| 2026-11-06 | dev | G4 studio-dark-restyle | pass | Vite build green; `tsc -b` errors only in 6 out-of-date unit test files (removed APIs), left to the tester; no orange, no CDN, no Google fonts in `src/web` |
| 2026-11-06 | dev | divergence old tokens and classes | decided | Material 3 roles and type classes deleted, not re-pointed: no user left (batch decision "Old names") |
| 2026-11-06 | dev | divergence accent deep | decided | `--accent-deep` `#008ef4` (hue 205°) only at the dark end of gradients; for human review |
| 2026-11-06 | dev | divergence row and dialog details | decided | State name right of line 1, time right of line 2; dialog row hover on surface 3 (surface 2 would not show); ResumeDialog load error stays inline |
| 2026-11-06 | dev | process developer commands | decided | One `python3 --version`, one `perl` substitution and `sed -i` edits reported; no effect outside the batch files |
