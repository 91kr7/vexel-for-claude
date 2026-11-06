---
status: validated
---

# Batches — Search in the session history

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [history-search](batches/batch-history-search.md) | Search in the session history | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17 | — | implemented | The user finds past sessions by typing part of their label |

## Assumptions and decisions

- **One batch.** The spec has one feature, so the plan has one batch. The batch of the English UI plan is certified, so nothing comes before it.
- **Frontend only.** PastSessionListRoute already sends every session with its label and its group folder. The ResumeDialog loads the whole list on open, so it filters in the browser. No route and no server code change.
- **No new component.** The search lives in the ResumeDialog. Two Lucide icons join IconSet. The Lucide licence already covers them, so ThirdPartyNotices does not change.
- **Enter and Esc.** The Dialog runs the primary action on Enter, unless the content element handles Enter itself. The bar handles it, so REQ-15 holds. Esc stays with the Dialog (REQ-14).
- **Texts, the bar during loading, the hidden selection and the style.** The batch file fixes them, in "Texts fixed by this plan" and "Decisions". The texts and the hidden-selection rule are explicit assumptions, decided by the gatekeeper on 2026-11-06.

## Departures

None. No human decision contradicts the spec.

## Coverage check

Every REQ is served by at least one INT. All INTs are in `batch-history-search`, and every REQ closes there.

| REQ | INT |
|-----|-----|
| REQ-1 | INT-1, INT-2 |
| REQ-2 | INT-2 |
| REQ-3 | INT-3 |
| REQ-4 | INT-3 |
| REQ-5 | INT-3 |
| REQ-6 | INT-3 |
| REQ-7 | INT-3 |
| REQ-8 | INT-4 |
| REQ-9 | INT-1, INT-5 |
| REQ-10 | INT-3 |
| REQ-11 | INT-2 |
| REQ-12 | INT-7 |
| REQ-13 | INT-2, INT-4, INT-5 |
| REQ-14 | INT-6 |
| REQ-15 | INT-6 |
| REQ-16 | INT-3 |
| REQ-17 | INT-1, INT-2, INT-8 |

Every INT from INT-1 to INT-8 serves at least one REQ. There is no enabling-only intervention.
