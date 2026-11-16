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
