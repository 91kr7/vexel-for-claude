# Gates — session_notifications

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-06 | analysis | question analyst Q1 | decided | Evolution: `desktop_app.md` line 84 put notifications and tray count out of scope |
| 2026-11-06 | analysis | question analyst Q2 | decided | Tray counts only "needs input": request "sessioni in attesa", page counter "N needs input" |
| 2026-11-06 | analysis | G1 analysis | sent back | Grouping inside one session → across sessions (design proposed in chat, human: "fai l'impl che ritieni opportuna"); tray order from the page's drag order → longest waiting first; hook removal is outside the product |
| 2026-11-06 | analysis | G1 analysis | pass | ordinary, 119/200 lines; additions accepted: notification removed when the session is opened or no longer needs input, session-end text says if it ended with an error |
| 2026-11-06 | plan | question planner Q1 | decided | REQ-29 default: a session leaves the grouped notification under REQ-11/12/19; the alternative breaks REQ-19 |
| 2026-11-06 | plan | question planner Q2 | decided | REQ-12: focus regained with the session already open counts as opening it |
| 2026-11-06 | plan | question planner Q3 | decided | 5 features accepted: each event rule, grouping and tray can fail on their own |
| 2026-11-06 | plan | G2 requirements | pass | REQ-1..37 cover the spec; REQ-29 is a derived rule kept inside the spec's per-session rules |
| 2026-11-06 | plan | question planner Q4 | decided | Session end: stop() or exit code 0 → no event; non-zero → error; foreign signal → no error. Source: spec assumption on the exit command |
| 2026-11-06 | plan | question planner Q5 | decided | Replace in place: Electron `Notification` if it can, else one pure-JS D-Bus client package recorded in `.archi`; no hand-driven `gdbus`. Grouping needs true replacement |
| 2026-11-06 | plan | question planner Q6 | decided | Notification, tooltip and menu texts as proposed; wording of the list card and page counter |
| 2026-11-06 | plan | G3 coverage | pass | 5 vertical batches, REQ-1..37 covered, no cycle; later modify targets named by component (created by batch 1), as accepted in `desktop_app` |
| 2026-11-06 | dev | G4 needs-input-notification | pass | Build green (re-run); files map to INT-1..15; dependency `@jellybrick/dbus-next` per Q5 (8 transitive packages, no install script); divergences accepted: replace in place done early (needed for REQ-11), escaping in SystemNotifications only with `body-markup`, route `/api/attention` |
| 2026-11-06 | test | G5 needs-input-notification round 1 | sent back | 3 red in `attention-client.test.ts`: no retry after a failed connect (Node WebSocket fires `error`, not `close`), AttentionClient spec; `desktop-window` REQ-6 focus flake (passed 4 reruns, already noted in `desktop_app`) accepted |
| 2026-11-06 | dev | G4 needs-input-notification fix round 1 | pass | Retry on `error` and `close`, one per socket, in `src/desktop/attention-client.ts`; build green |
| 2026-11-06 | test | G5 needs-input-notification round 2 | pass | Re-run by gatekeeper: batch unit and API files 157/157; browser e2e 81/81 and Electron 20/20 from round 1 untouched by the fix (Electron not re-run to spare the user's display) |
| 2026-11-06 | dev | G4 turn-end-notification | pass | Build green (re-run); files map to INT-1..7; divergences accepted: AttentionClient accepts `turn_end` (needed for REQ-14), monitor's own tracker type with optional cause, INT-6 spec only, default TurnReader keeps `src/server/main.ts` unchanged |
| 2026-11-06 | test | G5 turn-end-notification round 1 | sent back | 1 red in `turn-reader.test.ts`: a line that starts exactly 128 KiB before the end is dropped (`tailLines` always drops the first line when `start > 0`); spec `sessions/turn-reader.md` |
| 2026-11-06 | dev | G4 turn-end-notification fix round 1 | pass | Tail read starts one byte earlier in `src/server/sessions/turn-reader.ts`; typecheck green |
| 2026-11-06 | test | G5 turn-end-notification round 2 | pass | Re-run by gatekeeper: batch and touched-component files 238/238; browser e2e 4/4 from round 1 untouched by the fix; no Electron run needed |
| 2026-11-06 | dev | G4 session-end-notification | pass | Build green (re-run); files map to INT-1..4; divergences accepted: one-line wiring in `src/server/main.ts` (registry to the monitor, needed by INT-2), AttentionClient accepts `session_end`, optional `registry` keeps old tests compiling |
| 2026-11-06 | test | G5 session-end-notification | pass | Re-run by gatekeeper: 6 batch files 170/170; tester 266/266 on 13 files; fake CLI gains `/crash` and `/pid` (test infrastructure); no e2e needed |
