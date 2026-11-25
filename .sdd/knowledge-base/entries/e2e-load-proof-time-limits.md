---
id: e2e-load-proof-time-limits
kind: guideline
scope: development, test
date: 2026-11-24
source: /sdd-auto, closing run of terminal_overflow
---

# Every time limit of an e2e test holds on a loaded machine

**Rule** → No e2e test fails only because the machine is loaded. This holds for the timeouts and also for every limit on a measured duration (`performance.now()`, `Date.now()`, frame times).

**Why** → The human, after `tab-change-transitions.spec.ts:353` failed in the full suite with 398 ms against a 300 ms limit, the day after the e2e timeouts had been raised: "ti ho fatto aumentare i timeout ieri!! ed ancora ci sono questi problemi???"

**How to apply** →
- test: a measured duration never has a tight fixed limit. Compare it with the test's own slowed effect (e.g. `SLOW_MS / 2`). Or judge it on a sample that one machine stall cannot fail, e.g. the median of the slowest value of each round. Or fail only on a frame that proves the limit was passed.
- test: a duration declared in CSS or in the code is not a measured duration, so its exact limit stays.
- test: a limit that fails only under the full-suite load is a defect of the test. Fix it in the same cycle, do not just log it.
