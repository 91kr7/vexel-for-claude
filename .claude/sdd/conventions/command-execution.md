# Convention — Running commands (build and test)

Command output enters the agent's context and costs tokens: verbosity must be kept to a minimum.

## Rules

- Run builds and tests in the **least verbose variant** available; if `.archi` records the quiet
  commands, use those.
- Examples of quiet variants:
  - Maven → `mvn -q`
  - Gradle → `gradle -q`
  - Vitest → `vitest run --reporter=dot`
  - Jest → `jest --silent`
  - Karma/Angular → `ng test --watch=false` with a minimal reporter
  - Playwright → `--reporter=dot` (or `line`)
  - npm → `npm --silent run <script>`
- On failure → do NOT re-run everything in verbose mode: re-run **only the failing part** (the
  single test or module) with the detail you need.
- If the output is still long → filter it (e.g. `| tail`, `grep` on the errors) instead of reading
  it whole.

## Scope of execution: narrow during the batch, wider in its closing run

- While working on a module → run **only that module's tests** (idiomatic filters: `mvn -q
  -Dtest=...`, a path or pattern for Vitest/Jest, `--grep` for Playwright).
- **During the development of a batch, the e2e run stays on that batch** → only the e2e files
  written for it (by path or by title). Never the full e2e suite as an iteration loop.
- **Closing run of an intermediate batch** → the batch's own tests, plus those of any component the
  batch modified across module boundaries. Never the full e2e suite, never the whole unit suite: a
  full pass is costly and the plan's closing run proves again whatever it would prove.
- **Closing run of the last batch** → the **complete e2e suite and the whole unit/component suite**
  (all modules), once the batch's tests are green: it is the non-regression verdict over the entire
  plan.
- Which one is the last batch is decided and communicated by the **orchestrator** (`/sdd-dev`): the
  subagent does not infer it on its own.
- If a wider run finds a failure outside the current module → it is a regression: fix it in a narrow
  scope and close with a new green run of the same breadth.
