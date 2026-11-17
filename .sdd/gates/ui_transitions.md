# Gates — ui_transitions

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-17 | analysis | request scoping | human decision | Human chose all eight proposed effects and OS reduced-motion only, no UI toggle |
| 2026-11-17 | analysis | G1 analysis | escalated | Theme change variant (dissolve or circle) assumed by the analyst, visible behaviour |
| 2026-11-17 | analysis | G1 analysis | human decision | Theme change uses the colour dissolve |
| 2026-11-17 | analysis | G1 analysis | pass | |
| 2026-11-17 | plan | question planner | decided | Durations 300 ms per effect, 600 ms per cascade; within spec Non-functional |
| 2026-11-17 | plan | question planner | decided | Slide-in/fade-out cover external sessions too; spec requirement 7 has no exclusion |
| 2026-11-17 | plan | question planner | decided | Theme dissolve on any change while open, not on first paint; spec requirement 6 and assumptions |
| 2026-11-17 | plan | G2 requirements | pass | |
| 2026-11-17 | plan | question planner | escalated | Session list panel has no collapse/expand; spec effect 4 rests on a missing control |
| 2026-11-17 | plan | question planner | human decision | Drop the session list panel effect; analysis corrected |
| 2026-11-17 | plan | G3 coverage | escalated | Shared Dialog frame also animates the New session dialog, not named in spec |
| 2026-11-17 | plan | G3 coverage | human decision | Every modal dialog animates, New session included; analysis corrected |
| 2026-11-17 | plan | G3 coverage | decided | Removed untracked batch-session-list-panel.md created in this cycle, planner has no delete tool |
| 2026-11-17 | plan | G3 coverage | pass | Wording "eight effects" in batches.md sent for fix with the validation |
| 2026-11-17 | dev modal-dialogs | G4 development | pass | |
| 2026-11-17 | dev modal-dialogs | G5 tests | pass | Intermittent session-action-shortcuts-resume:165 noted, recheck in final full run |
| 2026-11-17 | dev popovers | divergence developer | decided | Own buttons inert while leaving, same contract as leaving Dialog; no REQ changed |
| 2026-11-17 | dev popovers | G4 development | pass | |
| 2026-11-17 | dev popovers | G5 tests | pass | |
| 2026-11-17 | dev git-explorer-panel | divergence developer | decided | Close during open slide starts from open position, as dialogs; final state per REQ-28 |
| 2026-11-17 | dev git-explorer-panel | divergence developer | decided | Reopen during close mounts a fresh panel; today close already unmounts, no behaviour change |
| 2026-11-17 | dev git-explorer-panel | G4 development | pass | overflow hidden on conversation workspace explained by INT slide |
| 2026-11-17 | dev git-explorer-panel | question tester | decided | Panel takes no focus on open; source batches.md "Focus (REQ-27)" assumption |
| 2026-11-17 | dev git-explorer-panel | G5 tests | pass | playwright.config.ts change is test grouping only |
| 2026-11-17 | dev session-switch | divergence developer | decided | ExitPresence exports motionDurationMs, 4-line change to share the duration lookup; spec updated |
| 2026-11-17 | dev session-switch | G4 development | pass | |
| 2026-11-17 | dev session-switch | G5 tests | escalated | Keys typed while the new session connects are lost; also on code before the batch |
| 2026-11-17 | dev session-switch | G5 tests | human decision | Fix it now: buffer input until the connection opens; analysis and plan extended |
| 2026-11-17 | plan | G2 requirements | pass | REQ-33 amendment from spec requirement 8 |
| 2026-11-17 | plan | G3 coverage | pass | REQ-33 closed by session-switch/INT-4 |
| 2026-11-17 | dev session-switch | divergence developer | decided | Keys typed before the terminal exists (font load) stay out; REQ-33 covers an opening connection only |
| 2026-11-17 | dev session-switch | G4 development | pass | INT-4 |
| 2026-11-17 | dev session-switch | G5 tests | pass | Round 2, REQ-33 green |
| 2026-11-17 | dev theme-change | G4 development | pass | |
| 2026-11-17 | dev theme-change | G5 tests | sent back | REQ-26: clicks during the view transition hit <html>, pointer-events rule ineffective |
| 2026-11-17 | dev theme-change | G4 development | sent back | Click forwarding uses window unguarded; 5 color-dissolve unit tests throw ReferenceError |
| 2026-11-17 | dev theme-change | divergence developer | decided | A pointer press ends the dissolve early and is forwarded to the real target; allowed by REQ-28 |
| 2026-11-17 | dev theme-change | G4 development | pass | Round 2 |
| 2026-11-17 | dev theme-change | G5 tests | pass | Round 2 |
| 2026-11-17 | dev cascading-lists | divergence developer | decided | ListPresence instead of ExitPresence for removed list entries; ExitPresence handles one conditional element |
| 2026-11-17 | dev cascading-lists | G4 development | sent back | Drop slot counts a leaving entry; drag-reorder behaviour must not change |
| 2026-11-17 | dev cascading-lists | G4 development | pass | Round 2 |
| 2026-11-17 | dev cascading-lists | G5 tests | sent back | D1 REQ-16: no cascade at app start, presence result empty on the ready render |
| 2026-11-17 | dev cascading-lists | G5 tests | decided | R1 session-list.spec xterm locator strict mode from session-switch cross-fade; test to be scoped by tester |
| 2026-11-17 | dev cascading-lists | G5 tests | escalated | F1 project-search 300 projects flaky, fails 2/8 on main too |
| 2026-11-17 | dev cascading-lists | G5 tests | human decision | F1 pre-existing flaky test does not block the merge if it passes on rerun |
| 2026-11-17 | dev cascading-lists | G4 development | pass | Round 3, D1 fixed in list-presence.ts |
| 2026-11-17 | dev cascading-lists | G5 tests | sent back | D2: drag during cascade not dimmed, cascade animation overrides .dragging; R1 fixed |
| 2026-11-17 | dev cascading-lists | G4 development | pass | Round 4, D2: dragged entry plays no effect, layout change ends the cascade |
| 2026-11-17 | dev cascading-lists | G5 tests | sent back | D3: removed entry during cascade does not end it, layout key counts leaving entries |
