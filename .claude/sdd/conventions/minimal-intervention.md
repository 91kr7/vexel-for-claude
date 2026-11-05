# Convention — Minimal intervention on the code

Whoever touches the code makes the **smallest change that satisfies the contract**: nothing more.

## Rules

- Touch only what the batch (or the test being written) requires: every other line stays as it is.
- Targeted edits, never a rewrite of a file that already works.
- Existing code that already does the job → reuse it, do not duplicate it and do not replace it with
  your own version.
- No opportunistic changes outside the perimeter: no refactors, renames, reformatting, reordering of
  imports, dependency bumps, cleanups of code you were not asked to touch.
- What is not part of the perimeter and looks wrong → **report it in the final output**, do not fix
  it: it is the human who decides whether it becomes work of its own.
- More code is more surface to maintain and to review: a bigger intervention needs a reason, and the
  reason goes in the final output.

## By role

- **Developer** → the perimeter is the batch's interventions (INT). A change no INT and no spec asks
  for does not belong in the batch.
- **Tester** → the perimeter is the tests and their infrastructure (configuration, fixtures). The
  source code is never touched, not even by one line: a failure caused by the code is a defect to
  report.
