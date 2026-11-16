---
id: limited-test-parallelism
kind: guideline
scope: development, test
date: 2026-11-16
source: /sdd-auto, plan of multi_repo_workspace
---

# Test runs use few cores and little parallelism

**Rule** → Test runs never use the default parallelism: Vitest runs at most 4 workers and Playwright at most 3 at once. Never run two full suites at the same time.

**Why** → The human: "puoi fare in modo che i test girino con meno core ed eventualmente meno parallelismo. prima mi ha inchiodato completamente il pc".

**How to apply** →
- development: keep `maxWorkers: 4` in `vitest.config.ts` and `workers: 3` in `playwright.config.ts`; never raise them.
- test: never pass a higher `--maxWorkers` or `--workers`; run the full unit suite and the full e2e suite one after the other, never in parallel or in background together.
