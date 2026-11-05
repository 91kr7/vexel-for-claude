# Convention — Human acceptance

The form of a batch's **acceptance scenarios**: the user path that makes the REQs closed by the
batch observable.

## Where they live

- Full scenarios → section `## Human acceptance` of the batch file
  `.sdd/plans/plan-<slug>/batches/batch-<feature-slug>.md`.
- `batches.md`, "Human acceptance" column → **one line** per batch: the title of the main scenario
  only, so the plan table stays readable.
- The batch file must be enough on its own: whoever tests the batch finds the scenarios there,
  without opening `batches.md`.

## Format of a scenario

```markdown
### Scenario: <result the user obtains>

- REQ → REQ-3, REQ-4
- Given → <state of the system before the action>
- When → <action performed by the user>
- Then → <result the user observes>
```

- One line per step, in this order; `And` → an extra step of the same kind, at most one per keyword.
- `Given` = precondition, `When` = a single user action, `Then` = a single observable result.
- The REQs are cited by id, never by copying their text → convention `identifiers.md`.

## Rules

- **Observable by the human** → only what is visible on the screen or in the response. Database
  state, internal calls and log lines are not a `Then`.
- **The user's vocabulary**, not the implementation's → no class names, routes, tables or columns.
- One scenario for the main path, plus one per error the user can actually see. Not one per REQ.
- Every REQ closed by the batch appears in the `REQ` line of at least one scenario: if a REQ cannot
  be placed in any scenario, the batch is badly cut.
- The scenario is **documentation, not executable code** → no `.feature` file and no BDD runner: the
  tests stay in the framework the project already uses, declared in `.sdd/.archi`.
- Quoted GUI text follows the localization language the human chose, like the assertions on it →
  convention `code-language.md`.

## By role

- **Planner** → writes the scenarios when it writes the batches; the impossibility of writing one is
  a signal to cut the batch differently.
- **Tester** → derives the e2e tests from them, together with the UI component specs: the scenario
  gives the user path, the specs give the exact names.
- **Orchestrator** → presents them when closing the batch as an **optional manual check**: the batch
  is already certified by the green tests, the scenarios are not a gate.
