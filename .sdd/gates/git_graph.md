# Gates — git_graph

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-16 | analysis | question analyst: fix or evolution | decided | Evolution; graph and missing-repo case are outside `.sdd/analysis/git_explorer.md` |
| 2026-11-16 | analysis | question analyst: one cycle or two | decided | Two cycles, graph first, multi-repo next; KB `run-all-requested-items` |
| 2026-11-16 | analysis | question analyst: read-only | decided | Stays read-only; request asks only to view, `git_explorer.md` Read-only |
| 2026-11-16 | analysis | question analyst: what is replaced | human decision | Whole explorer (changes, diffs, history) on open-source components |
| 2026-11-16 | analysis | question analyst: graph content | human decision | Current branch only, merges included |
| 2026-11-16 | analysis | question analyst: multi-repo view and depth | human decision | Combined view grouped by repository with filter; whole tree minus dependency/build folders; for the next cycle |
| 2026-11-16 | analysis | G1 analysis | pass | 91 lines, class ordinary |
| 2026-11-16 | plan | G2 requirements | pass | REQ-5 overlaps REQ-3 via `plan-git_explorer/REQ-7`, harmless |
| 2026-11-16 | plan | G3 coverage | pass | Test-file INTs follow the idiom of earlier plans; `CommitDetail.tsx` list move matches the human decision "whole explorer" |
| 2026-11-16 | dev | question developer: licences of inlined packages | decided | Regenerate `docs/dependency-licenses.md` (existing record, "regenerate when dependencies change"); no custom Vite plugin |
| 2026-11-16 | dev | G4 batch-open-source-explorer | pass | Build green; `docs/dependency-licenses.md` and `src/web/styles.css` explained; chunk-size warning not a REQ |
