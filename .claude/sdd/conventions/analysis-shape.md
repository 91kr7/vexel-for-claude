# Convention — Shape and size of an analysis

An analysis is **proportionate to the request**. A narrow request gets a short file, a complex one a
deep file. Hard rule, not an aspiration: it outranks the section list of the analyst's Step 4.

Two acts serve it, in this order: choosing the sections, then checking the length. The first is a
judgement and belongs to the analyst; the second only measures whether the judgement held.

## Sections — the analyst chooses them, request by request

**No section is owed a paragraph.** The list in the analyst's Step 4 is an **inventory to choose
from, not a checklist to fill**: which sections a given analysis carries is decided on the request
in front of it, and nobody else decides it.

- Write a section when it tells the later phases something they could not deduce.
- Leave it out **entirely** when it does not → no heading, no placeholder, no "not applicable".
- **Never padded** → a section with nothing to say is dropped, not filled with restatement,
  generalities, or a rationale for its own emptiness.
- Dropping sections is the normal outcome on most requests, not a licence granted to bug reports.

The floor is four → **Request, Summary, Requirements, Scope**. Below that the later phases have
nothing to work from: the raw request, what is to be achieved, what must be true, and where it
stops. Everything else is chosen, never owed.

Which ones usually fall away is an observation, not an instruction: on a narrow request Business
goal, Market trends and Risks are most often the ones with nothing to add. Judge them anyway — a
one-screen change with a real risk keeps its Risks section.

## Size — the check on that judgement

The class is chosen **before writing**, from the request itself, and declared in the file's
frontmatter as `size:`.

| Class | The request is | Whole file |
|-------|----------------|------------|
| `narrow` | one screen, one behaviour, a rewording, a bugfix | under 80 lines |
| `ordinary` | one feature | under 200 lines |
| `broad` | a new product, a whole area | no ceiling, but earn every section |

- The budget verifies the section choice, it does not replace it: a file that fits by compressing
  ten sections nobody needed has failed the rule above while passing this one.
- Over budget → cut. Reconsider which sections earned their place first, then compress what stays.

## What is not a model

- **The analyses already in `.sdd/analysis/` are not a length reference.** They may predate this
  convention, and in an established project most of them do.
- Classify against the **request**, never against what the folder happens to contain: a neighbouring
  file of 400 lines is not permission to write 400, and its ten sections are not permission to write
  ten.
- The previous analysis of a fix/evolution is read for its **content**, not for its shape or size.

## Who checks

- The analyst chooses the sections, classifies, writes, and cuts before returning.
- The **orchestrator verifies** before committing: `wc -l` against the class in the frontmatter.
- Over budget → the orchestrator sends the file back **once**, naming the class, the budget and the
  actual count. What comes back is committed as it is: the budget is a corrective, not a gate.
