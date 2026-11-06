---
id: short-request-slugs
kind: guideline
scope: analysis, planning
date: 2026-11-06
source: /sdd-auto, analysis and plan of the desktop app request
---

# Short, specific names for each request

**Rule** → The slug of a request (analysis file, plan folder, gate log, branch) is a short name specific to that request. An evolution does not append its slug to the name of the previous analysis.

**Why** → The human: "stai praticamente accodando al plan precedente la richiesta nuova… capisci che non si capisce nulla così?? dai dei nomi più puntuali!!" A chained name such as `plan-claude_sessions_client-ui_redesign-…-fixed_order-desktop_app` cannot be read.

**How to apply** →
- analysis: an evolution gets a new 2-4 word snake_case slug for the request itself (e.g. `desktop_app`). The link to the earlier analysis lives in the `reference` frontmatter field, not in the name. This replaces the `<starting-file-name>-<evolution-request-slug>.md` naming of the analyst's procedure.
- planning: the plan folder, the gate log and the branch reuse that short slug (`plan-desktop_app`, `feat/desktop_app`).
