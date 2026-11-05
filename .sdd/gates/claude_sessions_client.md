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
