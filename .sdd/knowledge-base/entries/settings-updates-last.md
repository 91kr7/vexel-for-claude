---
id: settings-updates-last
kind: guideline
scope: analysis, planning, development, test
date: 2026-11-26
source: /sdd-auto, request of the remote notifications (ntfy)
---

# Updates is always the last section of the settings

**Rule** → In the settings popup the Updates section is always the last one; a new section goes before it.

**Why** → The human: "L'ultimo deve essere sempre quello relativo all'update."

**How to apply** →
- analysis, planning: a new settings section is placed before Updates, never after it.
- development: the section order keeps Updates at the end.
- test: a test of the section order checks that Updates is last.
