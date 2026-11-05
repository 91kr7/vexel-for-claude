# Convention — Language of the code

Everything that ends up in the generated project is **strictly in English**; the only exception is
GUI text visible to the end user, whose language the human decides.

## Always in English

- Source code → names of classes, functions, variables, constants, types.
- Code comments, javadoc and docstrings.
- Project structure → names of files, folders, modules and packages, including the skeleton created
  at init time.
- Test code → test names, assertions, comments.
- Technical text not meant for the end user → logs, internal error messages, API and JSON keys,
  route names and parameters.

## In the language chosen by the human

- Only GUI text visible to the end user → labels, titles, messages, confirmations.
- The human states the GUI language; if it is stated nowhere (prompt, spec, `.archi`), it is a
  **question for the human** → question-brokering convention.

## Outside the scope of this convention

- The workflow artifacts (`.sdd/`: analyses, plans, component specs, indexes, `.archi`) are in
  English as well, as required by the project CLAUDE.md.
