# Gates — resume_favorites

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-17 | analysis | question analyst | decided | Evolution: favorites filter out of scope in `favorite_session.md` |
| 2026-11-17 | analysis | question analyst | decided | Mark action on each popup row; the request names the popup |
| 2026-11-17 | analysis | question analyst | decided | Filter only in the popup, combined with search, off at every opening; nothing new persisted |
| 2026-11-17 | analysis | question analyst | decided | Size about 1.5x wider and shorter; exact values left to design |
| 2026-11-17 | analysis | G1 analysis | pass | 76/80 lines narrow; empty state and keyboard derive from the filter and mark action |
| 2026-11-17 | plan | G2 requirements | pass | REQ-1..19 cover the analysis; REQ-19 closes with the last batch |
| 2026-11-17 | plan | G3 coverage | pass | 3 batches, every REQ in an INT and a scenario; new route in history area named |
| 2026-11-17 | dev | G4 popup-size | decided | `styles.css` instead of TSX: INT-1 names "page styles", class already present |
| 2026-11-17 | dev | G4 popup-size | decided | 280 px floor on the 70 % height cap; serves batch decision "room for one row" |
| 2026-11-17 | dev | G4 popup-size | pass | build green, re-run by gatekeeper |
| 2026-11-17 | test | G5 popup-size | decided | `playwright.config.ts` change accepted as test infrastructure (serial fixture group) |
| 2026-11-17 | test | G5 popup-size | pass | 20 e2e green on gatekeeper re-run; 448 px assertion updated per REQ-1 |
| 2026-11-17 | dev | G4 popup-mark | decided | FavoriteIndicator left in place though unused in production: removal is outside the batch INTs |
| 2026-11-17 | dev | G4 popup-mark | pass | build green on gatekeeper re-run; files match INT-1..5 plus specs and indexes |
| 2026-11-17 | test | G5 popup-mark | pass | 65 unit and 31 e2e green on gatekeeper re-run; `favorite-session.spec.ts` updated to the star button contract |
| 2026-11-17 | dev | entry favorites-filter | decided | Run interrupted by shutdown; partial uncommitted diff in `ResumeDialog.tsx` is this cycle's work: new developer run reviews and completes it |
| 2026-11-17 | dev | entry favorites-filter | decided | First developer run was still alive and finished; second run stopped; duplicated CSS lines from the overlap removed by the gatekeeper |
| 2026-11-17 | dev | G4 favorites-filter | decided | One extra line in `theme/windows11.css`: toggle corners match the search field in the Windows 11 look |
| 2026-11-17 | dev | G4 favorites-filter | pass | build green on gatekeeper re-run; files match INT-1..3 plus spec and index |
| 2026-11-17 | test | G5 favorites-filter | decided | `ResumeDialog.test.tsx` button list updated to the new toggle contract (REQ-10) |
| 2026-11-17 | test | G5 favorites-filter | decided | `plan-usage.spec.ts:345` outside perimeter: intermittent (2 fails, 7 passes on branch, passes on main); terminal scroll not touched by the plan; flagged for review |
| 2026-11-17 | test | G5 favorites-filter | pass | 38 unit and 27 e2e green on gatekeeper re-run; full suites 3956 unit, 881/882 e2e |
| 2026-11-17 | fix analysis | human decision | human decision | Sticky project path handled as a fix of `resume_favorites` |
| 2026-11-17 | fix analysis | G1 analysis | sent back | Out-of-scope line on grouping by project contradicted existing groups |
| 2026-11-17 | fix analysis | G1 analysis | pass | 78/80 lines narrow; two new requirements on the visible project path |
| 2026-11-17 | fix plan | G2 requirements | pass | REQ-20, REQ-21 cover the two new analysis requirements |
| 2026-11-17 | fix plan | G3 coverage | pass | REQ-20→INT-1, REQ-21→INT-2; one-line path with start ellipsis plus tooltip flagged for review |
| 2026-11-17 | fix dev | G4 project-path | pass | build green on gatekeeper re-run; CSS scoped under `.resume-dialog` |
