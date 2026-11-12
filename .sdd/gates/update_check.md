# Gates — update_check

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-12 | analysis | question analyst Q1 | decided | Evolution: `desktop_app.md` Scope leaves out automatic updates; nothing there is corrected |
| 2026-11-12 | analysis | question analyst Q2 | decided | Newer version = published GitHub Release, not draft or pre-release; source `SECURITY.md` "Supported versions", tag `v0.1.0` |
| 2026-11-12 | analysis | question analyst Q3 | decided | Repository public, no credentials; source `README.md` and `CONTRIBUTING.md` clone URL, CI badge |
| 2026-11-12 | analysis | launch scope | decided | Check covers desktop window and browser page; `README.md` "Install and run" offers both, request says "l'applicazione" |
| 2026-11-12 | analysis | G1 analysis | pass | 71 lines vs narrow budget 80; request verbatim; no placeholders; no technical choices |
| 2026-11-12 | plan | question planner Q1 | decided | Closed notice lives in the open page only; reload shows it again; analysis puts remembering a close out of scope; minimal intervention |
| 2026-11-12 | plan | planner assumptions | decided | Semver comparison ignoring leading `v`; non-blocking banner, English text, existing UI look |
| 2026-11-12 | plan | test isolation | decided | No test calls the real GitHub; release source replaceable in tests |
| 2026-11-12 | plan | G2 requirements | pass | REQ-1..12 cover the analysis; one sentence each, verifiable |
| 2026-11-12 | plan | planner decision server-start check | decided | Check runs once per server start; a desktop start reusing a running server shows that server's result; edge case, no extra desktop INT |
| 2026-11-12 | plan | G3 coverage | pass | 1 batch, REQ-1..12; modify paths exist; INT-8 enabling; every REQ in a scenario |
| 2026-11-12 | dev | G4 development newer-version-notice | pass | build green (rerun); diff limited to INT files, styles.css, specs, indexes; env var `AI_CLIENT_RELEASE_SOURCE_URL` named by developer as the plan allowed |
| 2026-11-12 | dev | G5 tests newer-version-notice | pass | batch unit/REST 90 and e2e 9 green (rerun); tests and vitest.config env only; every REQ tested; full unit 2924 green |
| 2026-11-12 | dev | regression terminal-search.spec.ts:240 | pass | Outside perimeter; passes alone on the branch (11/11); already logged intermittent in `recent_projects.md` |
