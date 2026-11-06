# Gates — claude_sessions_client

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-05 | init | stack | decided | Human delegated the stack: Node 22 + Fastify + node-pty, React + Vite + xterm.js; source `.sdd/.archi` |
| 2026-11-05 | analyse | size check | pass | broad, 120 lines, no ceiling |
| 2026-11-05 | analyse | G1 analysis | pass | Start/stop/resume and "needs input" trace to "gestire le sessioni"; external-terminal sessions excluded as explicit assumption under human delegation |
| 2026-11-05 | plan | G2 requirements | sent back | REQ-21 "about one second" and REQ-22 "stays usable" not yes/no verifiable |
| 2026-11-05 | plan | question planner | decided | Ended sessions stay listed until client stops, no remove action; smallest scope |
| 2026-11-05 | plan | question planner | decided | New session labelled with project folder name until first message; REQ-12 |
| 2026-11-05 | plan | question planner | decided | List order after "needs input": most recent activity first; spec business goal |
| 2026-11-05 | plan | G2 requirements | pass | Validated conditional on the REQ-21/REQ-22 rewording |
| 2026-11-05 | plan | question planner | decided | Terminal mirror scrollback 10 000 lines, not 50 000; REQ-21/REQ-22 cost of snapshot |
| 2026-11-05 | plan | G3 coverage | pass | Later-batch `modify` points cite components by INT id: files do not exist yet |
| 2026-11-05 | plan | `.archi` GUI language | decided | Updated to Italian; source analysis Assumptions |
| 2026-11-05 | dev | G4 session-interaction | pass | Build green on re-run; diff explained by INT-1..INT-12 |
| 2026-11-05 | dev | divergence developer | decided | `@types/ws` dev dependency accepted: needed by `tsc -b`; `.archi` dependency table updated |
| 2026-11-05 | test | G5 session-interaction | sent back | Green (96 unit, 15 e2e) but two uncovered defects: refused WS upgrade leaves socket open; FolderChooser overwrites typed path (REQ-1) |
| 2026-11-05 | test | question tester | decided | Both fixed: add rules to specs app/LocalAccessGuard and folders/FolderChooser; smallest change |
| 2026-11-05 | test | `test.skip` in e2e | pass | Conditional guard when running as root, not a disabled test |
| 2026-11-05 | dev | G4 session-interaction fix | pass | Diff limited to the two specs and two sources named in the fix round |
| 2026-11-05 | test | G5 session-interaction | pass | 97 unit, 17 e2e, green on 3 orchestrator re-runs; one unnamed e2e failure in tester run not reproduced in 300+ repeats, logged as possible flake |
| 2026-11-05 | dev | G4 session-list | pass | Build green on re-run; diff explained by INT-1..INT-15 |
| 2026-11-05 | dev | divergence developer | decided | Command hooks instead of http hooks; INT-15 met by existing SessionView key; temp hook folder per server start accepted (small, outside projects) |
| 2026-11-05 | test | G5 session-list | sent back | 3 red from code: HookEventRoute malformed JSON body; LiveSessionStore stop() vs pending load; non-JSON frame throws |
| 2026-11-05 | dev | G4 session-list fix | pass | Diff limited to hook-event-route.ts and live-session-store.ts; build green |
| 2026-11-05 | test | G5 session-list | pass | Fix needed no new tests: orchestrator re-ran 200 unit and 24 e2e, all green |
| 2026-11-05 | dev | G4 stop-session | pass | Build green on re-run; diff explained by INT-1..INT-4 |
| 2026-11-05 | dev | divergence developer | decided | `Session.stop()` added for INT-1; INT-3/INT-4 one component with state passed by AppLayout; no visible behaviour change |
| 2026-11-05 | test | G5 stop-session | sent back | D1: confirmation dialog painted under the xterm terminal (REQ-24); 2 e2e red |
| 2026-11-05 | dev | G4 stop-session fix | pass | `.modal-backdrop` z-index only; build green; D1 tests green |
| 2026-11-05 | test | G5 stop-session | sent back | Tester: e2e "a failed stop request changes nothing" compares whole body text, fails when other sessions change; chooser typed-path e2e flaky under full e2e run only |
| 2026-11-05 | analyse | scope external sessions | human decision | Human: show sessions running in other shells in this cycle (list, read-only live view, take over); departure recorded in analysis and plan |
| 2026-11-05 | analyse | G1 analysis update | pass | External sessions added per human decision; only Requirements, Assumptions, Risks, Scope changed |
| 2026-11-05 | test | G5 stop-session | pass | Tests fixed to assert on the open session only and to wait for the home listing; 75 unit, 31 e2e green on 2 orchestrator runs |
| 2026-11-05 | plan | question planner | human decision | No hook in user `~/.claude/settings.json`; external sessions show working/idle only |
| 2026-11-05 | plan | question planner | decided | Ended external session leaves the list; only `kind: interactive` counts; read-only view = messages, replies, tool calls, truncated results |
| 2026-11-05 | plan | G2 requirements REQ-29..36 | pass | |
| 2026-11-05 | plan | G3 coverage external-sessions | pass | |
| 2026-11-05 | plan | suggestion planner | decided | rs/INT-2 matches `sessionId` from `~/.claude/sessions/<digits>.json` instead of cwd; exact warning for REQ-27/REQ-35 |
| 2026-11-05 | dev | G4 resume-session | pass | Build green on re-run; diff explained by INT-1..INT-10; `package.json` port change is the human's, committed apart |
| 2026-11-05 | dev | divergence developer | decided | Resumed session gets its Claude id at track time; sessions with no user message not listed; no visible REQ change |
| 2026-11-05 | test | G5 resume-session | pass | 221 unit, 35 e2e green on orchestrator re-run; e2e server command bypasses `npm start` because the human's `start` script fixes the port |
| 2026-11-05 | dev | G4 external-sessions | pass | Build green on re-run; diff explained by INT-1..INT-13; no write or `.key` access in `src/server/external` |
| 2026-11-05 | dev | divergence developer | decided | Transcript folder = cwd with every non-alphanumeric replaced, fallback search by sessionId; external id = Claude sessionId; INT-3 inside scanner; no visible REQ change |
| 2026-11-05 | test | G5 external-sessions | pass | 229 unit, 8 e2e green on re-run; tester full suites 361 unit, 43 e2e accepted; no source commit after it |
| 2026-11-05 | close | merge | pass | All 5 batches certified; merged into main with --no-ff |
| 2026-11-06 | analysis (fix strict origin) | question analyst Q1 | decided | Fix, not evolution: request "Correggere"; local-access NFR aims to let only the user drive sessions |
| 2026-11-06 | analysis (fix strict origin) | G1 analysis | pass | Minimal edit, +37 lines; `<qualsiasi porta>` is raw request text, not a placeholder |
| 2026-11-06 | plan (fix strict origin) | G2 requirements | pass | REQ-37..45 mirror the "Local access" bullets; `http` scheme in REQ-37 accepted as assumption |
| 2026-11-06 | plan (fix strict origin) | G3 coverage | pass | One batch `local-access`, REQ-37..45 covered, 3 existing modify paths + `package.json`; dev signal from the `dev` script, not `NODE_ENV` |
| 2026-11-06 | dev (fix strict origin) | G4 local-access | pass | Build green (re-run); files map to INT-1..4; divergences accepted: guard reads the real listening port from the server (works with `PORT=0`), optional `allowedPorts` default `[]` (strictest); 5 old guard test cases expect the old rule |
| 2026-11-06 | test (fix strict origin) | G5 local-access | pass | Re-run by gatekeeper: 110/110 batch files. Tester closing pass: unit 1279/1279, default e2e 317/317; 5 old guard cases adapted to the new contract; no Electron run |
