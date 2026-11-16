# Gates — multi_repo_workspace

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-16 | analysis | human decisions carried over | human decision | From the `git_graph` analysis questions: combined view grouped by repository with filter; whole tree minus dependency/build folders; submodules out |
| 2026-11-16 | analysis | G1 analysis | sent back | History one repo at a time contradicts the human decision; per-repository filter and folder skipping missing |
| 2026-11-16 | analysis | G1 analysis | pass | 116 lines, class ordinary; human decisions applied |
| 2026-11-16 | plan | question planner Q1: detection time limit | decided | No limit; analysis "at any depth" plus REQ-12 non-blocking |
| 2026-11-16 | plan | question planner Q2: colour assignment | decided | Palette in list order; keeps neighbours distinct, less to build |
| 2026-11-16 | plan | G2 requirements | pass | |
| 2026-11-16 | plan | G3 coverage: detection over the whole tree | escalated | Sessions in the home folder would scan all of `~`; machine froze earlier today |
| 2026-11-16 | plan | G3 coverage: detection depth | human decision | At most 4 levels below the project folder; departure from the analysis |
| 2026-11-16 | plan | G3 coverage: detection tests | decided | Temporary folders only, never the home folder |
| 2026-11-16 | plan | test parallelism | human decision | Vitest 4 workers, Playwright 3; KB `limited-test-parallelism` |
| 2026-11-16 | plan | G3 coverage | pass | Depth limit and temporary-folder rule applied |
| 2026-11-16 | dev | G4 batch-repo-detection | pass | Production code typechecks, vite build green; tsc errors only in old test files of INT-15 |
| 2026-11-16 | dev | divergences developer: single-repo error, damaged `.git`, path order | decided | Accepted; keep the old look, no REQ changed |
| 2026-11-16 | dev | G5 batch-repo-detection | pass | tsc clean, 505 unit + 44 e2e green, re-run by gatekeeper |
| 2026-11-16 | dev | G4 batch-grouped-changes | pass | Production code typechecks, vite build green; tsc errors only in old test files of INT-7 |
| 2026-11-16 | dev | route spec 500 answer | decided | Spec aligned with code: git errors become entries; defensive branch kept |
| 2026-11-16 | dev | G5 batch-grouped-changes | pass | tsc clean, 278 unit + 48 e2e green, re-run by gatekeeper; damaged `changes-store.md` spec sent to next developer run |
| 2026-11-16 | dev | G4 batch-combined-history | pass | Production code typechecks, vite build green; tsc errors only in old test files of INT-9 |
| 2026-11-16 | dev | divergences developer: history errors inside `loaded`, "<name>: <message>" format | decided | Accepted; REQ-26 holds, single repository unchanged |
| 2026-11-16 | dev | G5 batch-combined-history | pass | tsc clean, 573 unit + 53 e2e green, re-run by gatekeeper |
| 2026-11-16 | dev | G4 batch-repo-filter | pass | Production code typechecks, vite build green; extra files `ChangesTab.tsx`, `HistoryTab.tsx`, `SessionView.tsx`, `ConversationView.tsx` justified (colour by full-list position, filter keyed by folder) |
| 2026-11-16 | dev | G5 batch-repo-filter: `e2e/colours-type.spec.ts:160` | decided | Code defect: `--repo-color-4..6` are pink, violet, orange; palette moves to allowed hues, the ThemeTokens rule stays |
| 2026-11-16 | dev | G5 batch-repo-filter: `e2e/project-search.spec.ts:117` | decided | Passes on `main`, fails from `42a2a55`; race in the test (log read before the last frame when the count does not change); test fix sent to the tester |
| 2026-11-16 | dev | G4 batch-repo-filter palette fix | pass | Only `tokens.css` and `repository-colors.md`; sky/blue closeness accepted |
| 2026-11-16 | dev | G5 batch-repo-filter | pass | 325 unit + 78 e2e green, re-run by gatekeeper |
| 2026-11-16 | dev | full suites | pass | 3523 unit green; 4 e2e failures outside the perimeter (terminal timing), green on `--last-failed`, not in the previous full run |
