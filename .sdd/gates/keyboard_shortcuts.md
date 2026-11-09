# Gates — keyboard_shortcuts

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-09 | analysis | question analyst Q1 | decided | Evolution of `session_list_width.md`: shortcuts out of scope there (line 150), announced by the human (line 117) |
| 2026-11-09 | analysis | question analyst Q2 | human decision | Only Ctrl/Alt combinations, no single keys; no conflict with Claude Code or Ubuntu keys |
| 2026-11-09 | analysis | G1 analysis | pass | ordinary, 122/200 lines; IT/US layout NFR accepted as support of the request (no AltGr keys) |
| 2026-11-09 | plan | question planner Q1 | decided | Key map in `requirements.md` Assumptions accepted: keys left to later phases by the spec; Alt-based, Shift for stop/dismiss, Claude Code letters excluded |
| 2026-11-09 | plan | question planner Q2 | decided | Previous/next stop at list ends; spec asks wrap only for needs-input (REQ-8) |
| 2026-11-09 | plan | question planner Q3 | decided | Alt shortcuts act in text fields; no editing key among them (REQ-41) |
| 2026-11-09 | plan | G2 requirements | pass | REQ-1..46 cover the spec; REQ-42 panel-close exception traced to spec "Shortcuts panel" |
| 2026-11-09 | plan | G3 coverage | pass | 3 vertical batches, REQ-1..46 covered, rules REQ-34..46 close in shortcuts-panel; modify paths exist; INTs on the shortcut map/key handler cite the module index since the files come from batch navigation; planner defaults accepted: toast bottom centre 4 s, button before the switch, Dialog primary action optional, no desktop code change |
| 2026-11-09 | dev | G4 navigation | pass | Build green (re-run); files map to INT-1..10 plus specs/indexes; divergence accepted: open by shortcut onto a hosted session moves focus to the terminal as a click does (REQ-10 wins over the plan's focus note) |
| 2026-11-09 | test | G5 navigation | pass | Re-run by gatekeeper: unit 54/54, e2e navigation-shortcuts(+external) 15/15; no source change, no `.only`/`.skip`; `playwright.config.ts` claudeDirSpecs entry accepted as test infrastructure |
| 2026-11-09 | dev | G4 session-actions | pass | Build green (re-run); files map to INT-1..7 plus specs/index; command shape `session-command` and latest-subscriber rule accepted (no visible change) |
| 2026-11-09 | test | G5 session-actions | pass | Re-run by gatekeeper: unit 54/54, e2e session-action-shortcuts(+resume) 18/18; no source change, no `.only`/`.skip`; dev dependency `jsdom` accepted as test infrastructure (`.archi` foresees a DOM environment for the first component test; its "No jsdom" line is now stale, reported to the human) |
| 2026-11-09 | dev | G4 shortcuts-panel | pass | Build green (re-run); files map to INT-1..8 plus specs/index; divergences accepted: terminal rows keyed by character with a `terminal` command the handler never runs (REQ-44), button above the backdrop only while the panel is open (REQ-42), mouse press keeps the focus (REQ-30) |
| 2026-11-09 | test | G5 shortcuts-panel | pass | Re-run by gatekeeper: unit 97/97, e2e shortcuts-panel + studio-dark 49/49; tester closing run accepted: full unit 2136, browser e2e 507, Electron desktop-shortcuts 1; no source change, no `.only`/`.skip` |
| 2026-11-09 | test | earlier-plan test | decided | `e2e/studio-dark.spec.ts` top bar count 2→3: contract changed by REQ-22, not a defect |
| 2026-11-09 | closing | merge | pass | All batches certified; no source commit after the tester's full run |
