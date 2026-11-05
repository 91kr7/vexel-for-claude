---
description: "Runs the whole spec-driven workflow on its own, from the request to the merge into main: analysis, plan, development and tests of every batch. Acts as the gatekeeper: it reviews what every subagent produces, answers their questions, validates requirements and coverage, drives the fix loops and advances the workflow. It stops for the human only on business decisions."
argument-hint: "<request in free text | path of an analysis | path of a plan folder | empty = resume open work>"
---

# /sdd-auto — Autonomous workflow with gatekeeper

Runs the cycle `/sdd-analyse` → `/sdd-plan` → `/sdd-dev` for `$ARGUMENTS` without pauses, then merges
the branch into `main`. You take the place of the human at every gate that is not a business decision.

## Role

- You (the main session) are the **orchestrator and the gatekeeper**. You do not write the analysis,
  the plan, the code or the tests: the same subagents of the manual commands do it.
- **Orchestrator** → you follow the steps of the manual commands, which stay the source of the
  procedure: `.claude/commands/sdd-analyse.md`, `.claude/commands/sdd-plan.md`,
  `.claude/commands/sdd-dev.md`. Read them and apply them, with the overrides of this file.
- **Gatekeeper** → after every subagent run you review its output against the criteria below. You
  either let the workflow advance, send the work back to the same subagent with `SendMessage`, or
  escalate to the human.
- All the conventions in `.claude/sdd/conventions/` still hold: commit, branching, knowledge base,
  writing style, command execution. Read the ones the manual commands cite.

## Overrides of the manual commands

These four points replace what the manual commands say. Everything else is unchanged.

1. **Questions from a subagent** → you answer them, not the user (see "Answering questions").
2. **Validation of requirements and of coverage** (`/sdd-plan` steps 3 and 4) → you validate them
   with the gates G2 and G3, not the user.
3. **Red tests from defects in the code** (`/sdd-dev` step 13) → you start the fix iteration without
   asking. There is no limit on the number of rounds (see gate G5).
4. **Reintegration** (`/sdd-dev` step 18) → when the plan is complete you merge into `main` without
   asking (see "Closing").

## When you stop for the human — escalation

Escalate only these cases. Use `AskUserQuestion`, put your recommendation first, and give the facts
you found in one or two lines each.

- A **business choice** the request, the analysis and the requirements do not settle: a behaviour
  the user will see, a scope that grows or shrinks, a priority between two goals.
- **Fix or evolution**, when the related analysis does not make the answer clear.
- A **departure from the spec**: a decision that contradicts the analysis. You never depart on your
  own.
- A knowledge base entry at odds with a convention, with `.archi` or with the request (convention
  `knowledge-base.md`).
- `.sdd/.archi` is missing → the stack is the human's call: suggest `/sdd-init` and stop.
- The starting conditions of `branching.md`: uncommitted changes in the working tree, or a branch
  already merged into `main`.
- A failing test **outside the plan's perimeter** that also fails on `main` → it is older than this
  cycle: the human decides.
- Any destructive action that no convention asks for: force push, history rewrite, deleting data or
  files that the cycle did not create.

The human's answer is a human decision. Pass it to the subagent as one. A departure is recorded as
the planner records it. If the human teaches something durable while answering, write it to the
knowledge base (convention `knowledge-base.md`, orchestrator role).

## Answering questions

When a subagent returns questions, sort each one:

- **Derivable** → the answer follows from the request, the analysis, `requirements.md`, the batch
  file, the knowledge base, `.archi`, the module specs or the code. Find it, with targeted reads
  only, and write the answer with its source (path, and REQ or INT id when there is one).
- **Technical with no source** → choose the option that touches less and follows the idiom already
  used in the project (convention `minimal-intervention.md`). Write the answer and one line of
  reason.
- **Business** → escalate (see above). Batch together every business question of the same run into
  a single `AskUserQuestion`.

Resume the **same subagent** with `SendMessage`. Mark every answer of yours as "gatekeeper decision"
so the subagent records it as an explicit assumption in its artifact, never as a human decision.
Your answers are never knowledge base material.

## Gate log

Record every verdict in `.sdd/gates/<request_slug>.md`, so the human can audit the run afterwards.
Create the file at the first gate. One row per verdict:

```markdown
# Gates — <request_slug>

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-10-26 | plan | G2 requirements | sent back | REQ-4 is not yes/no verifiable |
| 2026-10-26 | plan | G2 requirements | pass | |
| 2026-10-26 | dev | question developer | decided | Use the existing `TaskStore`; source `.sdd/modules/core/index.md` |
```

- Verdicts → `pass`, `sent back`, `decided`, `escalated`, `human decision`.
- Short reasons, by id or path, never copied text (convention `writing-style.md`).
- The log is committed with the step it belongs to (convention `commit.md`).

## Gates

Every gate first runs the mechanical check of the manual command, then this review. Read the
artifact itself, not only the subagent's summary. To send work back, list the findings precisely:
file, id, what is wrong, what is expected.

If the same finding comes back unresolved twice, stop sending it back. A business finding is
escalated. Otherwise accept the work, and log the finding with verdict `pass` and the reason.

### G1 — Analysis (after `sdd-analyst`)

- The size check of `analysis-shape.md`. It sends back **once only**, as that convention says. It
  is not a gate.
- The frontmatter is complete and the file has no `<...>` placeholders and no open questions.
- `Request` keeps the raw text of `$ARGUMENTS`.
- Nothing the request asks for is missing from Requirements or Scope. Nothing outside the request
  was added. An addition you cannot trace back to the request is scope creep: send it back. If the
  addition looks useful, escalate.
- No technical choices: stack, libraries, design.

### G2 — Requirements (`sdd-planner` stop for requirements validation)

- Every requirement of the analysis is covered by at least one REQ. No REQ goes beyond the analysis.
- Every REQ is one sentence, verifiable yes/no, observable, and neutral about the implementation.
- REQs that are always implemented together are not split. Independent behaviours are not merged.
- The vocabulary is the spec's (planner principle "the plan speaks the spec's language").
- Pass → resume the planner with "requirements validated by the gatekeeper".

### G3 — Coverage (`sdd-planner` stop for coverage validation)

- Every REQ has at least one INT. Every INT serves a REQ, or is declared enabling.
- One batch = one feature. No batch is cut by layer.
- The "REQ closed" list is the same in the `batches.md` table, the coverage check and the batch
  frontmatter.
- The dependencies have no cycle. Every `depends` points to a batch that exists.
- An INT `what` fits in three lines. A `create` gives the area only, never a file or class name. A
  `modify` gives an exact path, and that path exists.
- Every batch file has its `## Human acceptance` section. Every REQ the batch closes appears in a
  scenario (convention `human-acceptance.md`).
- New components are named in `## What this batch builds`.
- No departure the human did not decide. A departure the planner proposes on its own is escalated.
- Pass → resume the planner with "coverage validated by the gatekeeper".

### G4 — Development (after `sdd-developer`)

- The mechanical check of `/sdd-dev` step 9. Also re-run the build yourself with the canonical quiet
  command in `.sdd/.archi`: do not trust the report alone.
- `git status` and `git diff --stat` show only files the batch INTs explain, plus specs and indexes.
  A file outside them → send back: justify it or revert it.
- No test file was written or changed. No plan file was touched (`batches.md`, `requirements.md`,
  batch files).
- Divergences the developer reports between the plan and the code → judge them. A divergence that
  changes a REQ or a visible behaviour is a business point: escalate. Any other divergence: decide
  and log.

### G5 — Tests (after `sdd-tester`)

- The tester changed no source code and no plan file. The diff holds test files and their artifacts
  only. Source changed → send back to the tester to undo them.
- The diff adds no `.only`, `.skip`, `fixme` or disabled test. Check with
  `git diff -U0 | grep -nE '^\+.*\b(only|skip|fixme)\('`.
- Every REQ the batch closes has at least one test.
- Confirm the result yourself. Re-run the batch's own test commands in quiet mode (convention
  `command-execution.md`). On the last batch, accept the tester's full-suite run and do not repeat
  the twenty-minute pass. The one exception is in "Closing".
- **Green** → certify, as `/sdd-dev` step 13 does.
- **Red from defects in the code** → resume `sdd-developer` with the list of defects, then run G4,
  then a new Test phase. No limit on rounds. If two rounds in a row return the same defects, do not
  forward them a third time unchanged. Read the failing test and the code around the defect, and
  find the cause:
  - the code is wrong → give the developer a precise diagnosis: file, line, contract violated;
  - the test does not mirror the contract → send it to the tester, citing the contract;
  - the requirement itself is wrong → business: escalate.
- **Regression inside the plan's perimeter** → it is a defect like the others: same loop.
- **Regression outside the plan's perimeter** → check it on `main`. Use `git worktree add` on a
  temporary path, run only that test there, then remove the worktree. It fails on `main` too →
  escalate. It passes on `main` → the branch caused it: treat it as a defect.

## Steps

### 1. Startup

1. Get the date with `date +%Y-%m-%d`.
2. Check `.sdd/.archi` exists. Missing → escalate.
3. Find where to start from `$ARGUMENTS`:
   - **free text** → a new request: start at phase 2.
   - **path of an analysis** (`.sdd/analysis/*.md`) → its plan is `.sdd/plans/plan-<file name>/`.
     No plan → phase 3. Plan present → decide as for a plan folder.
   - **path of a plan folder** → `requirements.md` or `batches.md` still `draft` → phase 3, and tell
     the planner it resumes an interrupted iteration on the files that exist. `batches.md`
     `validated` → phase 4.
   - **empty** → look for open work: plans with a batch not `certified`, then analyses without a
     plan. Exactly one → resume it. More than one → escalate the choice. None → ask the user for
     the request.
4. Switch to the branch of the cycle (convention `branching.md`), except for a new request: phase 2
   opens it.

### 2. Analysis

Follow `.claude/commands/sdd-analyse.md` with its steps 1 to 6, with the overrides. Gate **G1**
comes before the branch is opened and before the commit.

### 3. Plan

Follow `.claude/commands/sdd-plan.md` with its steps 1 to 6. Gates **G2** and **G3** replace the two
human validations.

### 4. Development and tests

Follow `.claude/commands/sdd-dev.md` from startup to step 16. Gate **G4** after every development
run, gate **G5** after every test run. One change to its entry gates: a batch `in progress` with a
clean working tree and no `implement batch` commit for it is work that was lost. Set it back to
`todo` and log it. With uncommitted changes the working tree is not clean: escalate.

Do not stop between batches to report. Keep a short running note for the final report.

### 5. Closing

1. Not every batch is `certified` → the plan is stuck. No merge. Report what is missing, then stop.
2. Did any commit change source code after the tester's full-suite run of the last batch? This
   happens, for example, with a fix after the last full pass. Then re-run the complete e2e suite and
   the whole unit suite yourself. Red → back to G5.
3. **Merge into `main`**, without asking: the human chose automatic reintegration for this command
   (convention `branching.md`). Switch to `main`, merge with `git merge --no-ff <branch> -m "Merge
   <branch> into main"`, run the build on `main`. Do not push and do not delete the branch. A
   conflict → abort the merge (`git merge --abort`), stay on the branch and escalate.

### 6. Final report

Report to the user, schematically:

- The request, the analysis path, the plan folder, the branch, the merge outcome.
- The batches certified, with the main components touched.
- Your decisions → count by phase, with the path of the gate log. Then list the decisions that most
  deserve a human review: the ones that chose between options, not the ones read from a source.
- The questions escalated, and the human's answers.
- The departures from the spec, if any: the analysis must be corrected.
- The knowledge base entries created or updated, with their paths. Omit the line if there are none.
- The acceptance checklist of every batch, as `/sdd-dev` step 15 gives it: an optional manual check.

## Delegating to Gemini (on request)

If the user asks to delegate one or more phases to Gemini / Google Antigravity, delegate them as the
manual commands say (convention `gemini-antigravity-delegation.md`). The gates stay yours.
