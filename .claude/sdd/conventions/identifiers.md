# Convention — Identifiers

The id scheme used in the workflow artifacts (requirements, interventions).

## Scheme

- `REQ-n` → identifies a requirement. Numbered sequentially within the plan; the requirement text
  lives only in `requirements.md`.
- `INT-n` → identifies an intervention. Numbered sequentially within the batch; defined only in the
  file of its own batch.

## Namespace = path

- Ids are **local to the file that defines them**: it is the file path that makes them unique.
- Within its own scope an id is used unqualified: `REQ-3`, `INT-2`.
- Outside its own scope an id must be qualified with the path: `plan-<slug>/REQ-3`,
  `batch-<slug>/INT-2`.
- Example: a test derived from a requirement cites it as `plan-library_management/REQ-3`.

## Rules

- Ids are stable: never renumber after validation.
- Dependencies between INTs are declared only within the same batch; across batches the dependency
  is declared at batch level, in `batches.md`.
