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
