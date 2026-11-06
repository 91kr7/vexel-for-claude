# Gates — terminal_addons

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-06 | analysis | question analyst Q1 | decided | Evolution: the hosted terminal never had these features |
| 2026-11-06 | analysis | G1 analysis | pass | ordinary, 130/200 lines; file drop limited to the desktop app (browsers hide file paths) accepted as platform constraint; shortcuts are analyst defaults, to check against Claude Code and Electron keys at planning |
| 2026-11-06 | plan | G2 requirements | pass | REQ-1..54 in 4 features; shortcut check against xterm.js key mapping (no key Claude Code receives today is taken, undo kept by REQ-38); 4 placement and quoting assumptions decided |
| 2026-11-06 | plan | G3 coverage | pass | 4 vertical batches, REQ-1..54 covered, all modify paths exist; enabling e2e port/folder by env (parallel cycles); 2 new xterm addons; one small Electron check per desktop batch |
| 2026-11-06 | dev | G4 clickable-links | pass | Build green (re-run); files map to INT-1..9; accepted: terminal view that treats a full row as wrapped (addon joins only soft wraps); indented continuation rows not joined (REQ-7 risk for the tester); non-http OSC 8 are not links |
