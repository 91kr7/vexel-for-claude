---
description: "Implements and tests a whole technical plan, batch by batch: for each batch development (specs, code, indexes) and immediately after the tests derived from the contracts; on green tests the batch is certified automatically, with no human gate, and the next batch starts. Delegates to the sdd-developer and sdd-tester subagents."
argument-hint: "<path of the plan folder, e.g. .sdd/plans/plan-library_management>"
---

# /sdd-dev — Development and testing of a plan, batch by batch

Runs **all the batches** of the plan given in `$ARGUMENTS`, one after the other: for each one first
the development (`sdd-developer` subagent), then **immediately** the tests (`sdd-tester` subagent).
Once a batch is certified, it moves on to the next, until the plan is complete or gets stuck.

## Role

- You (the main session) are the **orchestrator**: you do not implement and you do not write tests.
- Development is done by `sdd-developer`; the tests are written and run by `sdd-tester`. They are
  two distinct subagents on purpose: whoever certifies is not whoever wrote the code.
- You handle: the loop over the batches and the choice of each one, the statuses in `batches.md`,
  the entry gates and the gates on red tests, the mechanical checks and the brokering of questions.
- You keep the **knowledge base** → convention
  `.claude/sdd/conventions/knowledge-base.md` (orchestrator role): read it and follow it.

## Steps

### Startup (once only)

1. Read `batches.md` in the plan folder. If the frontmatter says `status: draft`, stop: the plan has
   not been validated by the human yet.
2. Entry gates:
   - a batch is in status `tested` (a leftover from a run predating automatic certification) → its
     tests were green: move it to `certified` and carry on.
   - a batch is in status `implemented` → development finished but tests missing: skip straight to
     the Test phase for that batch (still work out whether it is the last batch, step 4, for the
     breadth of the tester's closing run).
   - a batch is in status `in progress` → a previous run was interrupted: report it to the user and
     stop, it is their call how to proceed.
3. **Switch to the branch** of the cycle — normally already opened by `/sdd-analyse` and carrying
   the analysis and the plan — or open it from `main` if it does not exist, following the convention
   `.claude/sdd/conventions/branching.md`. No batch is developed on `main`.

### Loop over the batches — repeat while there are workable batches

4. Choose the batch → the first one in status `todo` with all its dependencies in status
   `certified`. If there is none, leave the loop and go to **Closing the plan**. Also work out
   whether it is the **last batch** of the plan → it is when, besides the chosen one, no other batch
   is left to work on (all the others are already `certified`): this decides whether the closing run
   of the Test phase (step 11) widens to the **complete e2e suite and the whole unit/component
   suite**. On every other batch the run stays on the batch's own perimeter.
5. Get the current date in ISO-8601 format with `date +%Y-%m-%d`.

### Development phase

6. Move the batch status to `in progress` in `batches.md` (statuses are written by you, never by the
   subagents).
7. Launch the `sdd-developer` subagent via Task, passing it:
   - the path of the batch file (`batches/batch-<slug>.md`)
   - the path of `requirements.md`
   - the current date
8. If the subagent returns questions for the human → apply the convention
   `.claude/sdd/conventions/question-brokering.md` (orchestrator role): put the questions
   to the user, resume the same subagent with `SendMessage` and repeat until no questions are left.
9. On return, run the **mechanical check** (existence checks, not judgments of merit):
   - every component created or modified has its row in the module index and its spec in `specs/`
     (convention `indexes.md`);
   - a new module has its row in `modules.md`;
   - the subagent reports a **green** build; development **does not run the tests** — verification
     and non-regression are the Test phase's job. If in doubt, re-run the build yourself with the
     canonical commands given in `.sdd/.archi`.
   - If something is missing, resume the same subagent with the precise list of gaps, until the
     check passes.
10. Move the batch status to `implemented`, then **commit** the work of the developer (code, specs,
    indexes), following the convention `.claude/sdd/conventions/commit.md`.

### Test phase (right after development)

11. Launch the `sdd-tester` subagent via Task, passing it:
    - the path of the batch file (`batches/batch-<slug>.md`)
    - the path of `requirements.md`
    - the current date
    - the **summary delivered by the developer** (step 7): files touched, components created or
      modified, specs and indexes updated. Always pass it along: without it the tester reconstructs
      the batch's perimeter by itself, rummaging through the repository (`git status`, diffs, sweep
      searches), at a high cost and with a worse result.
    - whether it is the **last batch** of the plan (step 4) → the two full suites run there and only
      there, as the **last step before the plan is closed**: the complete e2e suite and the whole
      unit/component suite
    - on every other batch the run covers the **batch's own tests**, plus those of any component the
      batch modified across module boundaries. Never the full e2e suite, never the whole unit suite:
      a full pass costs about twenty minutes, and on an intermediate batch it proves nothing the
      plan's closing pass does not prove again
12. Questions from the tester → same brokering convention as step 8.
13. On return, assess the report:
    - **all tests green** → move the batch status straight to `certified`: green tests certify the
      batch, with no human acceptance gate (if in doubt, re-run the test commands given in
      `.sdd/.archi` to confirm), then **commit** the work of the tester (tests and their artefacts),
      following the convention `.claude/sdd/conventions/commit.md`.
    - **red tests caused by defects in the code** → present the report to the user and ask how to
      proceed: send the fixes to the developer (resume `sdd-developer` with the list of defects, then
      repeat the Test phase) or stop here (the status stays `implemented`). No fix iteration starts
      without their yes.

### Closing the batch and moving to the next

14. Batch `certified` → create the git commit that closes it: everything the batch touched and is not
    committed yet (the updated status in `batches.md`, any leftovers), following the convention
    `.claude/sdd/conventions/commit.md`. One closing commit per batch, not one at the end
    of the plan.
15. Report to the user, schematically, the outcome of the batch just closed:
    - the batch executed, the components created/modified and the build outcome
    - the tests written and the outcome of the run; the defects and regressions, if any
    - the knowledge base entries you created or updated during the batch, with their paths; omit
      the line if there are none
    - the **acceptance checklist** → read the `## Human acceptance` section of the batch file and
      report its scenarios: an optional manual check; the batch status is already `certified`
      thanks to the green tests.
16. Go back to step 4 for the next batch.

### Closing the plan

17. When step 4 finds no more workable batches, summarize for the user: the batches certified in this
    run and the main components touched, any batches left behind with the reason, and the overall
    status → **complete** if all the batches are `certified`, otherwise **stuck**, with the state of
    the table.
18. **Reintegrate the branch** → all the batches `certified`: propose the merge into `main` to the
    user and carry it out once they confirm, following the convention
    `.claude/sdd/conventions/branching.md`. Plan **stuck** → no merge: the branch stays as
    it is, say what is missing.

## Delegating to Gemini (on request)

If the user asks to **delegate the development and/or test phase to Gemini / Google Antigravity** →
do not launch the native subagent: delegate to the bridge subagent `sdd-gemini-runner`, passing it
the role concerned (`sdd-developer` for development, `sdd-tester` for the tests), following the
convention `.claude/sdd/conventions/gemini-antigravity-delegation.md`. The mechanical
checks, the gates and the handling of statuses in `batches.md` remain your job.
