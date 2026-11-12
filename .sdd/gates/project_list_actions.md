# Gates — project_list_actions

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-13 | analysis | question analyst Q1 | decided | Evolution: `recent_projects.md` put search, remove and favorites out of scope on purpose |
| 2026-11-13 | analysis | question analyst Q2 | human decision | A removed project comes back with new activity in its folder |
| 2026-11-13 | analysis | question analyst Q3 | human decision | A removed project leaves the Projects list only; "Recent" keeps it |
| 2026-11-13 | analysis | question analyst Q4 | human decision | Favorites at the top of the list, with a star |
| 2026-11-13 | analysis | analyst defaults | decided | Search on path, client-only remove with no confirmation, persistence and live sync accepted as proposed |
| 2026-11-13 | analysis | G1 analysis | pass | 102 lines vs ordinary budget 200; request verbatim; no placeholders; no technical choices |
| 2026-11-13 | plan | question planner Q1 | decided | REQ-16: any new activity in the folder, terminal-only included; source `plan-recent_projects/REQ-3` |
| 2026-11-13 | plan | question planner Q2 | decided | REQ-2: the search matches the path as the row shows it |
| 2026-11-13 | plan | G2 requirements | pass | REQ-1..32 cover the analysis; "Common" points split per feature |
| 2026-11-13 | plan | G3 coverage | pass | 3 vertical batches (favorite, remove, search); every REQ in an INT and a scenario; remove INT-1/3/5 point to components of batch favorite-project, accepted |
| 2026-11-13 | dev | interrupted run favorite-project | decided | Host process exited mid-batch; partial work kept in the tree, same developer resumed |
| 2026-11-13 | dev | incident port 4001 | decided | Developer's `pkill -f src/server/main.ts` stopped the human's running instance; later agents told never to kill processes by pattern |
| 2026-11-13 | dev | G4 development favorite-project | pass | build green (rerun); diff limited to INT files, styles.css, specs, indexes; SessionNameDialog.test.tsx fixture line needed by `tsc -b` (TS2741), accepted |
| 2026-11-13 | dev | divergence route names and file format | decided | `PUT /api/projects/favorite`, WebSocket `GET /api/projects/marks`, `project-marks.json` `{ favorites }`; plan leaves them open |
| 2026-11-13 | dev | G5 tests favorite-project (round 1) | sent back | Code defect: ProjectFavoriteButton.tsx:22 accepts any 2xx, spec wants 204 only; to developer |
| 2026-11-13 | dev | G4 development (fix round 1) | pass | build green (rerun); one line in ProjectFavoriteButton.tsx |
| 2026-11-13 | dev | G5 tests favorite-project (round 2) | pass | unit 264 and e2e 28 green (rerun); tests, playwright.config only |
| 2026-11-13 | dev | G4 development remove-project | pass | build green (rerun); diff limited to INT files, styles.css, specs, indexes |
| 2026-11-13 | dev | divergence remove route method | decided | `POST /api/projects/remove`: each call saves a new removal time; plan leaves the method open |
