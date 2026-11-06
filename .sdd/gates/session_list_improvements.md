# Gates — session_list_improvements

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-06 | analysis | question analyst Q1 | decided | Evolution: no earlier analysis asked for these behaviours |
| 2026-11-06 | analysis | question analyst Q2 | decided | Client-only name, hosted and external: `/rename` in the terminal interferes with the session; base NFR forbids writing history |
| 2026-11-06 | analysis | G1 analysis | pass | ordinary, 109/200 lines; three points covered; additions accepted: multi-tool count, 1 s minimum, 200-char limit |
| 2026-11-06 | plan | question planner Q1 | decided | REQ-36: "Resume Here" keeps the name; spec "survives a Resume", same conversation |
| 2026-11-06 | plan | question planner Q2 | decided | REQ-33: field stops at 200 characters after trimming, no error message |
| 2026-11-06 | plan | question planner Q3 | decided | REQ-27: name applies to notifications shown after the rename |
| 2026-11-06 | plan | G2 requirements | pass | REQ-1..39 cover the spec; label places split per REQ (each can fail alone) |
| 2026-11-06 | plan | question planner Q4 | decided | REQ-26: stop confirmation shows the folder, not the label, so it does not change |
| 2026-11-06 | plan | G3 coverage | pass | 3 vertical batches, REQ-1..39 covered, all modify paths exist; one enabling INT (e2e names folder); Resume of an ended session via a new route that removes the old entry |
| 2026-11-06 | dev | G4 dismiss-resume | pass | Build green (re-run); files map to INT-1..10; divergences accepted: `dismiss` returns a boolean, resume of a non-ended session → 409 `not_ended`, no Claude id → 404, `resumable` type in LiveSessionStore, styles; 1 old list-route test expects no `resumable` |
