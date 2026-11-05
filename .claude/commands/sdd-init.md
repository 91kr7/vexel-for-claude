---
description: Initializes the architectural skeleton of an app from a natural-language description of the stack. Creates the architecture on disk and produces .sdd/.archi. Delegates to the sdd-architect subagent.
argument-hint: "<description of the stack: technologies, language, build tool, ...>"
---

# /sdd-init — Architecture initialization

Delegates the creation of the architecture described in `$ARGUMENTS` to the `sdd-architect` subagent.

## Role

- You (the main session) are the **orchestrator**: you are not the one creating the architecture.
- It is created by the `sdd-architect` subagent.
- You act as the **broker** between the subagent and the human for questions.
- You keep the **knowledge base** → convention
  `.claude/sdd/conventions/knowledge-base.md` (orchestrator role): read it and follow it.

## Steps

1. Get the current date in ISO-8601 format with `date +%Y-%m-%d`.
2. Launch the `sdd-architect` subagent via Task, passing it the stack description (`$ARGUMENTS`) and
   the current date.
3. If the subagent returns questions for the human → apply the convention
   `.claude/sdd/conventions/question-brokering.md` (orchestrator role): put the questions
   to the user, resume the same subagent with `SendMessage` and repeat until no questions are left.
4. When the subagent has finished, **commit** what it produced, following the convention
   `.claude/sdd/conventions/commit.md`.
5. Report to the user, schematically:
   - the path of the `.archi` produced
   - the skeleton created (main folders and files)
   - the knowledge base entries you created or updated, with their paths; omit the line if there
     are none

## Delegating to Gemini (on request)

If the user asks to **delegate the initialization to Gemini / Google Antigravity** → do not launch
`sdd-architect`: delegate to the bridge subagent `sdd-gemini-runner` (role `sdd-architect`) following
the convention `.claude/sdd/conventions/gemini-antigravity-delegation.md`.
