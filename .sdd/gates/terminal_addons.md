# Gates — terminal_addons

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-06 | analysis | question analyst Q1 | decided | Evolution: the hosted terminal never had these features |
| 2026-11-06 | analysis | G1 analysis | pass | ordinary, 130/200 lines; file drop limited to the desktop app (browsers hide file paths) accepted as platform constraint; shortcuts are analyst defaults, to check against Claude Code and Electron keys at planning |
| 2026-11-06 | plan | G2 requirements | pass | REQ-1..54 in 4 features; shortcut check against xterm.js key mapping (no key Claude Code receives today is taken, undo kept by REQ-38); 4 placement and quoting assumptions decided |
| 2026-11-06 | plan | G3 coverage | pass | 4 vertical batches, REQ-1..54 covered, all modify paths exist; enabling e2e port/folder by env (parallel cycles); 2 new xterm addons; one small Electron check per desktop batch |
| 2026-11-06 | dev | G4 clickable-links | pass | Build green (re-run); files map to INT-1..9; accepted: terminal view that treats a full row as wrapped (addon joins only soft wraps); indented continuation rows not joined (REQ-7 risk for the tester); non-http OSC 8 are not links |
| 2026-11-06 | test | question tester Q1 | decided | REQ-7 keeps the batch rule (join only rows filled to the last column); continuation rows indented by Claude Code are a known limitation, reported to the human |
| 2026-11-06 | test | question tester Q2 | decided | Spec stays: an address ends only at whitespace or quotes, so a cut at `!` is a code defect |
| 2026-11-06 | test | question tester Q3 | decided | xterm's dashed rest underline on OSC 8 text accepted: REQ-12 holds (no hover, pointer, tooltip or open) |
| 2026-11-06 | test | G5 clickable-links round 1 | sent back | 3 red in `web-address-links.test.ts`: range end `{x:0}` on the next row when an address ends on the last column; `!` cuts the address |
| 2026-11-06 | dev | G4 clickable-links fix round 1 | pass | Own address pattern (ends at whitespace or quotes), range end moved back to the last column; typecheck green |
| 2026-11-06 | test | G5 clickable-links round 2 | pass | Re-run by gatekeeper: unit 47/47, browser e2e 9/9 on port 3200; Electron check 1/1 from round 1 untouched by the fix |
| 2026-11-06 | dev | G4 search | pass | Build green (re-run); files map to the batch INTs; accepted: current match shown as selection colour plus outline (renderer paints selection over decorations), `allowProposedApi` for highlights, worktree now has its own node_modules |
| 2026-11-06 | test | G5 search | pass | Re-run by gatekeeper: 3 unit files 148/148; e2e 11 new + 25 related on port 3200; terminal echo jumping into scrollback after long output seen also without search: outside the batch, noted for the human |
