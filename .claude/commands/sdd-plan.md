---
description: Turns a business spec into a technical plan split into batches (features, requirements, interventions) in .sdd/plans/plan-<slug>/, with human validation of the requirements. Delegates to the sdd-planner subagent.
argument-hint: "<path of the business spec/analysis file>"
---

# /sdd-plan — Technical plan

Delegates the technical planning of the spec `$ARGUMENTS` to the `sdd-planner` subagent.

## Role

- You (the main session) are the **orchestrator**: you are not the one writing the plan.
- The plan is produced by the `sdd-planner` subagent.
- You act as the **broker** between the subagent and the human, for questions and for the two
  validations.
- You keep the **knowledge base** → convention
  `.claude/sdd/conventions/knowledge-base.md` (orchestrator role): read it and follow it.
- You work on the **branch of the cycle**, normally opened by `/sdd-analyse` → convention
  `.claude/sdd/conventions/branching.md`.

## Steps

1. Get the current date in ISO-8601 format with `date +%Y-%m-%d`.
2. Launch the `sdd-planner` subagent via Task, passing it the path of the spec (`$ARGUMENTS`) and the
   current date.
3. The subagent stops for the **validation of the requirements** (and any questions):
   - present the user with the path of `requirements.md` and a schematic summary of the features and
     requirements
   - collect the confirmation or the corrections
   - apply the convention `.claude/sdd/conventions/question-brokering.md` (orchestrator
     role): resume the same subagent with `SendMessage` and repeat until the human validates.
4. When the batches are ready, the subagent stops for the **validation of the REQ ↔ INT coverage**:
   - present the user with the **paths** of the files produced and a schematic summary of the
     coverage (do not paste whole files into the chat)
   - the human validates by hand; collect the confirmation or the corrections
   - same convention as step 3: resume the same subagent until the human validates.
5. **Switch to the branch** of the cycle — the one named after the spec's `request_slug` — or open
   it from `main` if the analysis predates this rule and it does not exist, following the convention
   `.claude/sdd/conventions/branching.md`. The plan is not committed on `main`.
6. When the subagent has finished, **commit** what it produced, following the convention
   `.claude/sdd/conventions/commit.md`.
7. Report to the user, schematically:
   - the path of the plan folder
   - the branch opened (or switched to)
   - the list of batches produced, with their execution order (dependencies)
   - the new components the plan asks to build, one line each; omit the line if there are none
   - the knowledge base entries you created or updated, with their paths; omit the line if there
     are none

## Delegating to Gemini (on request)

If the user asks to **delegate the planning to Gemini / Google Antigravity** → do not launch
`sdd-planner`: delegate to the bridge subagent `sdd-gemini-runner` (role `sdd-planner`) following the
convention `.claude/sdd/conventions/gemini-antigravity-delegation.md`.
