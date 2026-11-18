---
id: tech-debt-register
kind: guideline
scope: any
date: 2026-11-18
source: /sdd-auto, fix of wsl_support (release v1.2.1)
---

# Known defects left open go to the technical debt register

**Rule** → A known defect that the human decides not to fix now is recorded in `.sdd/tech-debt.md`, one row per item.

**Why** → The human: "segna nel debito tecnico sta cosa del terminate!". The defect of Settings → Processes was left open for v1.2.1 and was written only in a gate log and a pull request.

**How to apply** →
- orchestration: when the human accepts a release or a merge with a known defect, add its row to `.sdd/tech-debt.md` (what, contract broken, evidence, proposed fix, who decided) in the same branch. When a later fix closes it, move the row to "Closed".
- analysis, planning: read `.sdd/tech-debt.md` when a request touches the same area, and cite the item it closes.
