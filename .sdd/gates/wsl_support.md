# Gates — wsl_support

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-13 | analysis | scope of the port | escalated | Branch `feature/wsl-support` holds three changes, only one stated as WSL-specific |
| 2026-11-13 | analysis | scope of the port | human decision | Port the whole branch, after reviewing what it brings |
| 2026-11-13 | analysis | G1 analysis | sent back | Notification log requirement said "once per app run", the branch logs once per run of identical consecutive failures |
| 2026-11-13 | analysis | G1 analysis | decided | Type `new` accepted: no analysis covers WSL, the branch spans four analyses |
| 2026-11-13 | analysis | G1 analysis | decided | WCAG 2.2 AA kept: standing level of the project, `light_theme.md` line 52 |
| 2026-11-13 | analysis | G1 analysis | pass | |
| 2026-11-13 | plan | question planner Q1 | decided | Log line allowed as `Then` of REQ-1..4: the spec asks for the line itself, read in the app's terminal output |
| 2026-11-13 | plan | question planner Q2 | decided | REQ-8 lifetime = running server, as ended hosted entries (no persistence in `session-state-tracker.ts`); spec Port line "no other change" |
| 2026-11-13 | plan | question planner Q3 | decided | Dismissed entry run again in a terminal shows as a live external entry |
| 2026-11-13 | plan | question planner Q4 | decided | Keyboard on ended external entries as `plan-session_list_improvements/REQ-13`; spec keyboard line |
| 2026-11-13 | plan | question planner Q5 | decided | One batch per feature, four batches |
| 2026-11-13 | plan | G2 requirements | pass | With REQ-41/REQ-42 merged (always implemented together) |
| 2026-11-13 | plan | G3 coverage | decided | REQ-14 without INT on AttentionMonitor: external sessions give no session-end event today |
| 2026-11-13 | plan | G3 coverage | decided | REQ-13: `resume` shortcut acts once, via ConversationView (batch ended-external-sessions INT-9) |
| 2026-11-13 | plan | G3 coverage | pass | Four batches, one per feature, no dependencies; lock file still lacks `license` on main |
| 2026-11-13 | dev | G4 failed-notifications | decided | Divergence from the branch accepted: only a call the server answers clears the last reason, so an empty `close` keeps REQ-2 true |
| 2026-11-13 | dev | G4 failed-notifications | pass | Build re-run green |
| 2026-11-13 | dev | G5 failed-notifications | pass | 53 unit tests green, re-run by the gatekeeper; REQ-5 by existing tests |
| 2026-11-13 | dev | G4 lock-file | pass | One line added, root version kept at 0.3.0 |
