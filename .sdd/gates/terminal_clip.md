# Gates — terminal_clip

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-26 | analysis | question analyst type | decided | Fix: same defect against `terminal_overflow.md` requirements; own file and slug, the reference cycle is merged (PR #41) |
| 2026-11-26 | analysis | question analyst trigger | decided | Unknown trigger: cover every situation of the reference again, no character hidden even in part |
| 2026-11-26 | analysis | G1 analysis | pass | 62 lines, `narrow`; no placeholders; request kept; no technical choice |
| 2026-11-26 | plan | G2 requirements | pass | REQ-1..12 cover the spec; REQ-1/2 define the stricter width, REQ-3..10 the reference situations, REQ-11/12 the new ones |
| 2026-11-26 | plan | G3 coverage | sent back | INT-1 is a test file written by the developer; the reproduction becomes a diagnostic step (not committed), the regression e2e goes to the tester |
| 2026-11-26 | plan | G3 coverage | pass | Reproduction is a diagnostic step; INT-1/INT-2 modify `SessionView.tsx`; tests and red-before-fix run by the tester |
| 2026-11-26 | dev | G4 development, terminal-width | pass | Cause reproduced: xterm.js DOM renderer measures glyphs in whole pixels (7.1875 vs 7.2012 px at 12 px), rows clip the last glyph by up to 1.7 px at 1280×800; fix in `SessionView.tsx` only; build green |
| 2026-11-26 | dev | divergences terminal-width | decided | Accepted: the fix corrects the drawn glyph width, not the fit count; it uses one more private xterm.js path (risk on upgrade, the regression e2e must catch it); INT-2 needs no code |
| 2026-11-26 | test | Electron group | human decision | An Electron run crashed the GNOME session (mutter SIGSEGV, `/var/crash` 19:49); no automatic cycle runs the Electron group; knowledge base `electron-e2e-separate` updated |
