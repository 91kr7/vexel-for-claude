# Gates — remote_notifications

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-26 | analysis | question analyst Q1 type | decided | Evolution of `input_sound.md`; adds a function, corrects no wrong behaviour |
| 2026-11-26 | analysis | question analyst Q2 reply channel | escalated | Scope: large feature with a security impact |
| 2026-11-26 | analysis | question analyst Q2 reply channel | human decision | Outgoing notification only; reply channel is a separate request |
| 2026-11-26 | analysis | question analyst Q3 when to send | escalated | Visible behaviour the request does not settle |
| 2026-11-26 | analysis | question analyst Q3 when to send | human decision | First answer unclear, asked again: send after 60 s still waiting for input |
| 2026-11-26 | analysis | extras test button and token | escalated | Not in the request; useful additions |
| 2026-11-26 | analysis | extras test button and token | human decision | Both included |
| 2026-11-26 | analysis | analyst defaults | decided | Needs input only, desktop app only, full detail, failures do not touch local alerts; follows `input_sound.md` |
| 2026-11-26 | analysis | G1 analysis | pass | 118 lines, ordinary; additions trace to the request, the human decisions or the gatekeeper defaults |
| 2026-11-26 | plan | question planner Q1 URL broken while on | decided | Switch turns off by itself; source REQ-10 |
| 2026-11-26 | plan | question planner Q2 test button | decided | Works with switch on or off, disabled on empty/invalid URL |
| 2026-11-26 | plan | question planner Q3 switch read time | decided | Read at the end of the 60 s; touches less |
| 2026-11-26 | plan | question planner Q4 waiting at start | decided | Nothing until a new entry; source spec rule, REQ-24 |
| 2026-11-26 | plan | question planner Q5 REQ-27 | decided | Confirmed; source spec Assumptions, no grouping |
| 2026-11-26 | plan | G2 requirements | pass | REQ-1 to REQ-39 cover every analysis requirement |
| 2026-11-26 | plan | question planner external sessions detail | escalated | Visible behaviour; the request asks for full information |
| 2026-11-26 | plan | question planner external sessions detail | human decision | Generic text only for external sessions |
| 2026-11-26 | plan | question planner token storage | decided | Plain text in a 0600 file; touches less, recorded as a risk |
| 2026-11-26 | plan | G3 coverage | pass | REQ-1 to REQ-39 covered; test-notification INT-5 modifies the section of notifications-section INT-6, no path yet as it does not exist |
| 2026-11-26 | dev | divergence menu id `sound` | decided | Internal id kept, label and title read "Notifications"; no visible change |
| 2026-11-26 | dev | divergence topic over 64 chars, trailing slash | decided | Reasons BAD_TOPIC and NO_TOPIC; technical, stated in the spec |
| 2026-11-26 | dev | G4 notifications-section | pass | Diff is INT-1 to INT-8 plus styles, specs and indexes; build green re-run by the gatekeeper |
| 2026-11-26 | test | G5 notifications-section | pass | Re-run by the gatekeeper: unit 153/153, browser e2e 25/25, Electron e2e 2/2; diff holds tests and the Electron spec pattern only |
| 2026-11-26 | dev | divergence RemoteSettingsStore read waits for saves | decided | Outside the INTs but closes a race between save and test; one line, store spec updated |
| 2026-11-26 | dev | divergence reason for a bad stored URL, null result | decided | Technical; the button is disabled on a bad URL, no visible change |
| 2026-11-26 | dev | G4 test-notification | pass | Diff is INT-1 to INT-5 plus the store line, styles, specs and indexes; build green re-run by the gatekeeper |
| 2026-11-26 | test | G5 test-notification | pass | Re-run by the gatekeeper: unit 179/179, browser e2e 12/12, Electron e2e 5/5; diff holds tests only |
| 2026-11-26 | dev | divergence RemoteNotifier component | decided | "On send" logic moved out of `main.ts` so Vitest covers it, as the batch test plan asks; no visible change |
| 2026-11-26 | dev | divergence waiting time and argument without tool | decided | Time from receipt of the event; argument without `waitingTool` gives "Needs your input"; technical |
| 2026-11-26 | dev | G4 remote-notification | pass | Diff is INT-1 to INT-8 plus RemoteNotifier, specs and indexes; build green re-run by the gatekeeper |
| 2026-11-26 | test | G5 remote-notification | sent back | `desktop-remote-notification.spec.ts:366`, `:369` tight 65 s limit on a measured duration; KB `e2e-load-proof-time-limits` |
| 2026-11-26 | test | stale test inside perimeter | decided | `desktop-notifications.spec.ts:251` bridge list lacked the three new functions; test-only change |
| 2026-11-26 | test | G5 remote-notification | pass | Re-run by the gatekeeper: unit 206/206, Electron e2e 3/3; tester full runs unit 4719/4719, browser e2e 1058/1058, Electron 52/53 + the stale test fixed |
| 2026-11-26 | test | `desktop-window.spec.ts` teardown error | escalated | Outside the perimeter; also fails on `main` (2 errors outside tests, `:825` failed) |
