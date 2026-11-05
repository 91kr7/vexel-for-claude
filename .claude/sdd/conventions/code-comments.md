# Convention — Code comments

Code explains itself through clear names; a comment is the exception, not the habit.

**The default is no comment.** Write one only when you have failed to make the code say it, and the
thing it says would be lost otherwise. Every comment is a line someone has to read, trust, and keep
true — a wrong comment is worse than no comment, and a comment that repeats the code becomes wrong
the first time the code changes.

## General rule

- Never write comments that narrate what the code does line by line or step by step.
- A comment is allowed only if it conveys something the code alone cannot express (e.g. the reason
  behind a non-obvious choice).
- If a clearer name makes the comment redundant, rename instead of commenting.

## How short

- **One line. Two if the reason genuinely needs them.** A comment block of three lines or more is a
  sign that what you are writing does not belong in the code at all.
- **Never a paragraph, never an argument, never a story.** The reasoning behind a decision, the
  alternatives that were rejected, the history of what was tried and withdrawn, the instructions to
  a future reader — all of that goes in the component spec, the requirement or the batch file, which
  is where it is looked for. The code carries at most the one sentence that stops the next reader
  from undoing the decision by accident.
- **Do not restate the requirement.** Its id is enough; the text lives in `requirements.md`.
- **Do not explain the obvious to justify it.** A token named `--toast-max-width` needs no comment
  saying it is the toast's maximum width.

## Applied to tests

- Every test states in **a single comment** (one line, above the test) the requirement or rule it
  verifies (qualified id).
- No other comment inside the test body: names and assertions must be enough on their own. What you
  are tempted to write inside belongs in the assertion message, where it is shown when the test
  actually fails.

## The existing code counts too

**When you open a file and find comments that break this convention, fix them in the same
intervention** — even if you did not write them, even if they were there before this plan existed.

- Only in files you are already modifying for the task at hand: this is not a licence to sweep the
  repository, and no separate "comment cleanup" batch is to be invented.
- Shorten to the one line that survives, or delete outright when the code already says it. If the
  comment carries a reason worth keeping, move it to the component spec and leave one sentence.
- **Delete a comment that has become false** on sight. Code that changed while its comment stayed is
  the most expensive kind of comment, and it is found exactly when someone is editing nearby.
- Report the cleanup in one line of your final summary. It needs no permission and no discussion.
