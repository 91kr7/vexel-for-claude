# Gates — session_notifications

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-06 | analysis | question analyst Q1 | decided | Evolution: `desktop_app.md` line 84 put notifications and tray count out of scope |
| 2026-11-06 | analysis | question analyst Q2 | decided | Tray counts only "needs input": request "sessioni in attesa", page counter "N needs input" |
| 2026-11-06 | analysis | G1 analysis | sent back | Grouping inside one session → across sessions (design proposed in chat, human: "fai l'impl che ritieni opportuna"); tray order from the page's drag order → longest waiting first; hook removal is outside the product |
| 2026-11-06 | analysis | G1 analysis | pass | ordinary, 119/200 lines; additions accepted: notification removed when the session is opened or no longer needs input, session-end text says if it ended with an error |
