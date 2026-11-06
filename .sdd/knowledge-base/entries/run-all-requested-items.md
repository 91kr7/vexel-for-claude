---
id: run-all-requested-items
kind: guideline
scope: any
date: 2026-11-06
source: /sdd-auto, after the session_notifications cycle
---

# A list of requests runs to the end without stopping

**Rule** → When the human asks for several points in one message, the orchestrator schedules every point and runs the cycles one after the other. It does not stop between cycles to ask for an "ok".

**Why** → The human: "ma non ti ho chiesto solo le notifiche!!! ti avevo chiesto una serie di punti! dovevi schedularli tutti!!" The orchestrator had stopped after the first cycle and waited for a go-ahead.

**How to apply** →
- orchestration: list the cycles at the start, then start the next cycle as soon as the previous one is merged. Report each cycle briefly and carry on. Stop only for the escalations that `/sdd-auto` allows.
