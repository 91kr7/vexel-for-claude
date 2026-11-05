# Convention — Delegating to Gemini via Google Antigravity (`agy`)

When the human explicitly asks to **delegate the step to Gemini / Google Antigravity**, the
orchestrator does not launch the step's native subagent, but delegates it to the bridge subagent
**`sdd-gemini-runner`**, which performs the same role through the **`agy`** CLI (Google Antigravity).

It applies **only on the human's explicit request** (e.g. "do it with Gemini", "delegate it to
Antigravity"). With no such request → native subagent via `Task`, as always.

## Principle: isolate the context

Gemini's raw output is heavy and must not pollute the orchestrator's context. That is why the
delegation **runs inside a subagent** (`sdd-gemini-runner`): the `agy` output stays in the bridge's
context, and the orchestrator only gets a schematic summary (file paths + outcome + any questions).

**The orchestrator never opens the files written by the bridge** (neither with `Read` nor by
re-reading them any other way): the bridge's summary is the only source it consults. Re-reading them
defeats the isolation and doubles the token cost for the same content.

## Who does what

- **Orchestrator** → instead of the native subagent, launches `sdd-gemini-runner` via `Task`,
  passing it **the name of the role to delegate** (`sdd-analyst`, `sdd-planner`, `sdd-developer`, …),
  the step input, the current date and the chosen Gemini model. It handles question brokering and
  the checks/gates required by the command, as always.
- **`sdd-gemini-runner`** → reads the role's prompt file
  (`.claude/agents/<role>.md`), forwards it to `agy` in print mode, and **writes
  itself** the files the step must produce. It does not reinterpret the role: it is a conduit. The
  operational detail is in its own prompt.

The bridge does not copy the roles' logic: it forwards **the very same prompt** as the native agent,
adding only the output contract (Gemini in print mode does not write files → it emits the content as
delimited text, which the bridge writes to disk).

## Choosing the model

- Default for reasoning/planning → `Gemini 3.1 Pro (High)`.
- Default for lighter tasks → `Gemini 3.5 Flash (High)`.
- Always check the exact name with `agy models` (it must be passed in quotes: it contains spaces and
  parentheses).
- If the human names a model, use that one.

## Steps for the orchestrator

1. Get the current date (`date +%Y-%m-%d`).
2. Choose the model (see above) or use the one the human indicated.
3. Launch `sdd-gemini-runner` via `Task`, passing it: role to delegate, step input, date, model, and
   any human answers to earlier questions.
4. On return, treat the bridge's summary **as you would the native subagent's output**: same
   mechanical checks, same gates, same question brokering (convention
   `.claude/sdd/conventions/question-brokering.md`). For a new iteration (fixes or
   answers), relaunch `sdd-gemini-runner`. **Do not read the files** the bridge has written: trust
   the summary — the checks stay mechanical (the declared paths exist), never about the merits of
   the content.
5. In the summary to the user, state that the step was produced **via Antigravity/Gemini** and with
   which model.

## Safety and limits

- **Print mode only** → `agy -p` produces text, it does not touch the filesystem. The bridge writes
  the files. No `--dangerously-skip-permissions`, no `agy` in agent mode.
- **The prompt leaves the machine** → it is sent to the model provider's servers. **Never** put
  secrets, credentials or sensitive data in the prompt.
- **Print mode ≠ a full subagent** → a one-shot prompt does no web research and no multi-step tool
  iteration. For steps that genuinely need them (e.g. market trends in `sdd-analyst`), consider
  whether delegation is appropriate or keep the native subagent.
- **Non-determinism** → the output can vary between runs; the bridge always validates before
  writing.

## Common problems

- `command not found: agy` → use the absolute path `~/.local/bin/agy`, or check the PATH.
- Timeout in print mode → raise `--print-timeout` (e.g. `10m`).
- Invalid model name → copy the **exact** name from `agy models`.
- Output with extra text or non-conforming files → the bridge retries, reinforcing the output
  contract.
