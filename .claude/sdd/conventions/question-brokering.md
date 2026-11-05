# Convention — Brokering questions and answers

How a subagent (which runs unattended) asks the human for clarification: the orchestrator acts as
the broker, and the subagent's context must not be lost.

## The subagent's role

- Collect the questions only the human can answer and return them to the orchestrator; do not write
  them into the output file. Then stop.
- When you are resumed with the answers, keep the context of the previous iteration: do not start
  over from scratch.
- Leave no placeholder in the output file (no `<...>`): every point is either decided, or an
  explicit assumption with a justified default.
- If the human does not want to decide a point, record it as an explicit assumption, never as a
  question in the file.
- If you have no questions, carry on without stopping.

## The orchestrator's role (command)

- When the subagent returns questions for the human, put them to the user (you are the broker) and
  collect the answers.
- Resume **the same subagent** with `SendMessage` (not a new Task), passing it the answers: that way
  it keeps the context of the first iteration.
- Repeat until no questions are left.
- Under `/sdd-auto` the orchestrator is also the gatekeeper. It answers the questions it can
  derive or decide, and puts only the business questions to the user (see that command).
- The answers collected here are **not** knowledge base material: they resolve this step and live in
  its artifact (convention `.claude/sdd/conventions/knowledge-base.md`).
