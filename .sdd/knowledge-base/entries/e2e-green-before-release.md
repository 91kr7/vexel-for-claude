---
id: e2e-green-before-release
kind: guideline
scope: any
date: 2026-11-18
source: release of v1.2.0
---

# Failing e2e tests are fixed before a release

**Rule** → A release is published only after the complete browser e2e suite is green on the commit to release. Failing e2e tests are fixed first.

**Why** → The human: "mi devi assolutamente fixare gli e2e in errore prima di fare la release". v1.2.0 was published while the full e2e run still had 6 failures.

**How to apply** →
- orchestration: before `gh release create`, run the complete e2e suite on the release commit and wait for its result. Any failure → fix it (a test fix or a code fix), then run the suite again. No release while it is red.
- test: a failure that passes on a re-run is not green. Find the cause and fix it before the release.
