# Convention — Writing the artifacts

Every markdown this workflow produces is reviewed by a human. That human may not be a native English
speaker, and a long document is harder to review than a short one. Write for them.

**Technical terms stay. Complicated English goes.** Keep the exact word for the thing — `cache`,
`endpoint`, `subprocess`, `poll`, `batch`. Simplify the language around it. A reader who works in
this domain knows the terms. They may not know the idioms.

## Sentences

- One idea per sentence. Then a full stop.
- Active voice. "The server reads the value", not "the value is read by the server".
- Common words: *use* not *utilise*, *so* not *hence*, *about* not *regarding*, *start* not
  *commence*, *enough* not *sufficient*.
- At most one subordinate clause. If you need a second, write a second sentence.
- No idioms and no metaphors. They are the hardest thing to read in a foreign language.
- A dash or a parenthesis usually hides a second sentence. Take it out and write it.

| Instead of | Write |
|------------|-------|
| A cell that grew into a paragraph is a subsystem hiding in a table | An intervention that needs a paragraph is really several interventions |
| Bound together, the slowest-changing value is read on the schedule of the fastest-changing one | The size of a volume changes slowly. Today it is read every three seconds, because it is read together with the volume list. |
| The failure mode of this design is an application that costs less and feels slower — the operator stops a container and the row does not change | If this is built wrong, the application costs less but reacts more slowly. The operator stops a container and the row does not change. |

## Length

- A requirement → one sentence. A second one only to state an exception.
- An intervention's `what` → three lines, the limit the planner already applies.
- A section → what it needs, and nothing added to round it off.
- Delete any sentence that would not change what the reviewer does.
- Never explain one decision in two places. Choose where it belongs, write it there, cite it
  elsewhere by id or path.

## Drop these

- "It is worth noting that", "It should be pointed out that", "Importantly," → say the thing.
- A sentence whose only job is to announce the next sentence.
- A paragraph that repeats the title of its own section.
- The same fact restated in other words for emphasis. Say it once.

## By role

- **Analyst, planner, developer, tester, architect** → every markdown you write under `.sdd/`,
  including component specs and index rows.
- Commit messages follow this too → convention `commit.md`.
- Code comments have a stricter rule of their own → convention `code-comments.md`.
