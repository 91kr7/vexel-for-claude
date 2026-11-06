---
id: chat-in-italian
kind: guideline
scope: any
date: 2026-11-06
source: /sdd-auto, during the session_usage and terminal_addons cycles
---

# Messages to the human are in Italian

**Rule** → Every message the orchestrator writes to the human in chat is in Italian, status updates included. The artifacts under `.sdd/`, the code and the commit messages keep their own language rules.

**Why** → The human: "in italiano per cortesia", after short status updates written in English.

**How to apply** →
- orchestration: write every chat message to the human in Italian, from the first line. Technical terms and identifiers stay as they are.
