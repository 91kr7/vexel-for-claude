# Gates — mac_title_bar

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-06 | analysis | question analyst Q1 | decided | Evolution: a window without the native bar was never specified; `light_theme.md` line 79 left it out |
| 2026-11-06 | analysis | G1 analysis | pass | ordinary, 101/200 lines; derived additions accepted: buttons and drag in every window state, empty drag area at every width, clicks on controls never drag, browser unchanged |
| 2026-11-06 | plan | question planner Q1 | decided | No added window border: the spec lists it only as a risk; to check by hand on GNOME |
| 2026-11-06 | plan | G2 requirements | pass | REQ-1..28 in 2 features (title bar, window buttons) cover the spec |
| 2026-11-06 | plan | G3 coverage | pass | 2 batches, REQ-1..28 covered, all modify paths exist; startup page stays light (no access to the saved theme) accepted; double click left to the desktop's title bar action via the drag region |
| 2026-11-06 | dev | G4 title-bar | pass | Build green (re-run); files map to INT-1..5; accepted: INT-4 as a `.modal` rule in `styles.css` instead of `Dialog.tsx` (smaller change); GNOME double click, edge resize and shadow unverified, left to tests and the human |
| 2026-11-06 | test | question tester Q1 | decided | Alt menu bar lost without the native frame: accepted, the request removes the native chrome; DesktopApp spec drops "Alt shows it" |
| 2026-11-06 | test | G5 title-bar round 1 | sent back | Window opens maximized with `frame: false` (GNOME auto-maximize), DesktopApp spec says 1280 × 800: code defect; Alt test to follow the spec change |
