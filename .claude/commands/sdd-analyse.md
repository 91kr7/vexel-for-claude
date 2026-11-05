---
description: Analyzes a request (however trivial) from a business standpoint and produces an analysis on file, the first step of the spec-driven workflow. Delegates to the sdd-analyst subagent.
argument-hint: "<request to analyze, free text>"
---

# /sdd-analyse — Business analysis

The first command of the spec-driven workflow.
It delegates the analysis of the request `$ARGUMENTS` to the `sdd-analyst` subagent.

## Role

- You (the main session) are the **orchestrator**: you are not the one writing the analysis.
- The analysis is produced by the `sdd-analyst` subagent.
- You act as the **broker** between the subagent and the human for questions.
- You keep the **knowledge base** → convention
  `.claude/sdd/conventions/knowledge-base.md` (orchestrator role): read it and follow it.
- You open the **branch of the cycle**: this command is normally the first that writes, so the
  branch is yours to open → convention `.claude/sdd/conventions/branching.md`.

## Steps

1. Get the current date in ISO-8601 format with `date +%Y-%m-%d`.
2. Launch the `sdd-analyst` subagent via Task, passing it the request (`$ARGUMENTS`) and the current
   date — **and nothing else**. No project files, no `.archi`, no paths to earlier analyses, no
   extracts from any of them: the analysis comes from the request, and the subagent finds the
   `.sdd/analysis/` context it needs on its own in its Step 1. Handing it project material is how an
   analysis turns technical and outgrows its budget.
3. If the subagent returns questions for the human → apply the convention
   `.claude/sdd/conventions/question-brokering.md` (orchestrator role): put the questions
   to the user, resume the same subagent with `SendMessage` and repeat until no questions are left.
4. **Check the size** of the file produced → convention
   `.claude/sdd/conventions/analysis-shape.md`: read the `size:` class in its frontmatter
   and compare the budget with `wc -l`. Over budget → resume the same subagent with `SendMessage`,
   naming the class, the budget and the actual count, and asking it to cut. **Once only**: what
   comes back is committed as it is.
   - Which sections the file carries is the subagent's call, not yours: a missing section is the
     rule working, never something to send back. You measure the length, nothing else.
5. **Open the branch** of the cycle, now that the slug and the type are known, following the
   convention `.claude/sdd/conventions/branching.md`. Before the commit, never after: the
   analysis is not committed on `main`.
6. **Commit** what the subagent produced, following the convention
   `.claude/sdd/conventions/commit.md`.
7. Report to the user, schematically:
   - the path of the analysis file produced
   - the type of analysis: new, fix or evolution
   - the branch opened (or switched to)
   - the knowledge base entries you created or updated, with their paths; omit the line if there
     are none

## Delegating to Gemini (on request)

If the user asks to **delegate the analysis to Gemini / Google Antigravity** → do not launch
`sdd-analyst`: delegate to the bridge subagent `sdd-gemini-runner` (role `sdd-analyst`) following the
convention `.claude/sdd/conventions/gemini-antigravity-delegation.md`.
