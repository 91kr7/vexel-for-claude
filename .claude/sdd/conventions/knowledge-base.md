# Convention — Project knowledge base

The knowledge base is what the human **teaches** the agents: how to do something they do not know
how to do, and the guidelines on how this plugin's workflow and specs are applied in this project.
Written down once, honored by every phase without having to be repeated.

## Where it lives

```
.sdd/knowledge-base/
├── index.md                      ← index: one entry per row
└── entries/
    ├── ui-italian-labels.md
    └── ...
```

- One entry = one rule, in its own file: small files, single responsibility.
- The folder is created on the first entry; if it does not exist, the knowledge base is empty.
- **This is the only store**: what the human teaches is never written to the assistant's own memory,
  nor to any note outside the repository.
- Reason → a note outside the repository is not reviewed, not versioned and not visible to the
  human; it drifts out of step with the artifacts and then contradicts this workflow silently.
- An assistant memory is never a source either: a teaching found there is re-verified with the human
  and written here, and the memory removed.

## What goes in

Two kinds of entry, and nothing else:

- **`how-to`** → a procedure or a technique the agents do not know: how a tool of this project is
  driven, the steps of an operation that cannot be deduced, the trick that makes something work.
- **`guideline`** → how the plugin's workflow and specs are applied here: a stylistic preference for
  the artifacts, a standing constraint on the work, a way of interpreting a step.

In both cases the entry must be **durable and reusable**: it holds beyond the current request, and
it is not already written elsewhere (an artifact — `.archi`, analysis, requirements, specs, indexes
— that already records it is the source; the knowledge base does not duplicate it).

Examples → "GUI text always in Italian", "component specs never longer than one screen", "to
regenerate the client from the OpenAPI file, run … first".

## What never goes in

- **The human's answers to the agents' questions.** A question brokered during a step is answered
  to unblock *that* step: the answer becomes a decision, an assumption or a requirement **in the
  step's artifact**, never an entry here (convention `question-brokering.md`).
- One-off decisions on today's work → "in this batch call it `LoanService`", "yes, go ahead".
- Anything the agents deduced, assumed or inferred: the knowledge base holds only what the human
  taught, in their own words.

## Format of an entry (`entries/<slug>.md`)

```markdown
---
id: <slug in kebab-case>
kind: <how-to | guideline>
scope: <analysis | architecture | planning | development | test | any — one or more, comma-separated>
date: <ISO-8601, the date received as input>
source: <the phase/command in which the human gave the indication>
---

# <Title>

**Rule** → one line: what must always be done (or never done).

**Why** → one or two lines: the reason the human gave, or the context in which it was born.

**How to apply** → one line per phase concerned: what changes concretely for whoever reads it.
```

## Format of the index (`index.md`)

| Entry | Kind | Scope | Rule | File |
|-------|------|-------|------|------|
| ui-italian-labels | guideline | development, test | GUI text and assertions on it in Italian | `entries/ui-italian-labels.md` |

- One row per entry, the rule in a single sentence: the index locates, it does not explain.
- The index is the only file read in full: it is what makes the knowledge base cheap to consult.

## The subagents' role — read only

They consult the knowledge base in their context step; they never create or modify an entry.

### How to consult it

1. Read `.sdd/knowledge-base/index.md`, if it exists. Missing → the knowledge base is empty, carry
   on.
2. Open **only** the entries whose `scope` covers your phase (or is `any`) and that are relevant to
   the work at hand.
3. Apply them as if the human had just repeated them; report in the final output which entries you
   applied, cited by id.

## The orchestrator's role (command) — the only writer

It is the one talking to the human, so it is the one that writes: no other agent creates or modifies
an entry.

- **When** → the human, in chat, teaches something or lays down a guideline (asking for it
  explicitly, or simply saying it). Write the entry in that same turn and say so.
- **Where** → here, and only here: never the assistant's own memory (see "Where it lives").
- **Never** starting from an answer to a question a subagent asked → see "What never goes in".
- New teaching → new file in `entries/` + its row in `index.md`. A teaching that refines an existing
  entry → edit that entry (minimal diff), do not create a second one.
- The entry uses the human's words: no extrapolation, no rule they did not state.
- Entries created or modified are declared to the human and committed with the step in progress
  (convention `commit.md`).

## Precedence

- The knowledge base **refines** the plugin conventions and the artifacts, it never contradicts
  them.
- A knowledge base entry at odds with a convention, with `.archi` or with the current request → a
  question for the human (convention `question-brokering.md`), not a decision of your own.
- An entry the human contradicts during a run → update it there and then: the newest teaching
  wins.
