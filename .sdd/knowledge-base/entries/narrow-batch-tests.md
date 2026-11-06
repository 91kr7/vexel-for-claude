---
id: narrow-batch-tests
kind: guideline
scope: test
date: 2026-11-06
source: /sdd-auto, test phase of batch running-tool (session_list_improvements)
---

# An intermediate batch tests only what it touches

**Rule** → On an intermediate batch the tester runs the batch's new tests, the existing tests of the files the batch changed, and the tests of their direct dependencies: the components that use a changed file. Existing e2e specs run only when they exercise the changed behaviour or one of those dependencies directly. No wide e2e sets "for safety": the plan's closing run covers regressions.

**Why** → The human: "come mai i test sono così lenti? dovrebbero testare solo cio' che toccano", then: "cio' che toccano ed eventuali dipendenze". A batch that touched `SessionList.tsx` and `main.ts` ran 86 e2e and 300+ unit tests.

**How to apply** →
- test: on an intermediate batch, list the exact test files to run and why: changed file, or direct dependency of a changed file. Do not re-run a passing set to look for flakiness. Prefer unit tests over real-server and e2e tests when both prove the same REQ.
