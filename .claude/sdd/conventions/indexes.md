# Convention — Module indexes

Indexes are the map of the code: they locate components without exploring the sources. The planner
reads them; the developer writes and maintains them.

## Structure: one folder per module

```
.sdd/modules/
├── modules.md             ← root index: one module per row
├── users/
│   ├── index.md           ← module index: one component per row
│   └── specs/
│       ├── user-service.md
│       └── ...
└── catalog/
    ├── index.md
    └── specs/ ...
```

- A **module** is a domain area (e.g. users, catalog, loans), not a technical layer: it covers both
  the backend and the frontend side of its area.
- Everything that describes a module lives in its folder: the index and the specs of its components.

## Format of the root index (`modules.md`)

| Module | Responsibility | Index |
|--------|----------------|-------|
| users | Registry of the library's users | `users/index.md` |

## Format of a module index (`<module>/index.md`)

| Component | Type | Path | Responsibility | Spec |
|-----------|------|------|----------------|------|
| LoanService | backend service | `backend/src/.../loan/LoanService.java` | Registers and closes loans, applying the domain rules | `specs/loan-service.md` |

- The **Type** column classifies the component: entity, backend service, REST endpoint, UI
  component, etc.
- The path of the source file lives **here only**: the component spec does not repeat it.
- One row per component, responsibility in a single sentence: the index locates, it does not
  explain.

## How to consult them (funnel descent)

1. Read `modules.md` and identify the candidate modules.
2. Open **only** the `index.md` files of the candidate modules and identify the components.
3. To understand a component, open its spec (in `specs/`, same folder); the code is opened only as a
   last, targeted check.

## How to maintain them

- Whoever creates or modifies a component updates the `index.md` of its module **in the same run**.
- Whoever creates a new module creates the folder (`index.md` + `specs/`) and adds the row in
  `modules.md`, **in the same run**.
- An index that does not mirror the code is worse than no index: on divergence, report it and fix
  the index.
