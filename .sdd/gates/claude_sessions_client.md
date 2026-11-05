# Gates — claude_sessions_client

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-05 | init | stack | decided | Human delegated the stack: Node 22 + Fastify + node-pty, React + Vite + xterm.js; source `.sdd/.archi` |
| 2026-11-05 | analyse | size check | pass | broad, 120 lines, no ceiling |
| 2026-11-05 | analyse | G1 analysis | pass | Start/stop/resume and "needs input" trace to "gestire le sessioni"; external-terminal sessions excluded as explicit assumption under human delegation |
