# Convention — Commit at the end of each step

Every step of the workflow closes with a git commit: the work of an agent is never left uncommitted.

## Who commits

- The **orchestrator** (command) commits, never the subagents.
- The commit happens **after the subagent returns** and after the mechanical checks have passed.

## When to commit

- At the **end of every subagent run** → commit what that agent produced.
- In `/sdd-dev`, in addition, at the **close of every batch** → one commit per batch, not one at the
  end of the plan.

## What goes into the commit

- Every file the agent created or modified (analysis, plan, specs, code, indexes, tests, statuses,
  knowledge base entries).
- `git add` of those paths only: nothing unrelated to the step just finished.

## Message

- Written in **English**.
- Schematic → concise subject, any details as a list.
- **No reference to the assistant anywhere in the message**: not in the subject, not in the body, not
  in the trailers.
  - no `Co-Authored-By: Claude ...` trailer;
  - no `Generated with Claude Code` line, no link to the tool, no emoji signature;
  - no mention of Claude, of an AI or of an agent as the author or co-author of the work.
- The message describes **what was done**, never **who or what did it**.
- Subject naming the step and its object, e.g. `sdd-plan: technical plan for library management`.

## Nothing to commit

- If the working tree is clean, do not force an empty commit: report it and carry on.
