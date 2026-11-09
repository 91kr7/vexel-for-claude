---
status: validated
---

# Batches — Plan usage limits view

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [plan-usage-view](batches/batch-plan-usage-view.md) | Plan usage view | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18 | — | in progress | The user sees the 5-hour and weekly limits |

Execution order: `plan-usage-view`.

## Assumptions and decisions

- **One batch.** The spec has one feature. The button cannot be tested without the view, and the view needs the figures, so a split would be by layer.
- **New components.** Nine, named in the batch "What this batch builds": the plan limits rule, the credentials token reader, the plan limits reader, the plan usage route, the reset time format, the plan usage store, the plan limit row, the plan usage popover and the usage button. The backend ones go in the app area, the nearest module, because plan limits are not about sessions. The developer records the exact paths in the indexes.
- **Source of the figures (human decision, 2026-11-09).** A backend service reads the sign-in token, read-only, from `<claudeDir>/.credentials.json` and calls the Anthropic usage endpoint that `/usage` uses. It is an exception to the no-credentials rule of the module `history`. The batch file ("Decisions") sets the token rules and the checks on the real account. If a check fails, the developer stops and asks the human.
- **Gatekeeper decisions.** Refresh every 60 s, a popover with no mock (`requirements.md`, "Assumptions"), the usage button after the theme switch, and a failed refresh that hides the figures.
- **Divergence from reality (2026-11-09).** The developer's check on the real account found a different answer shape and different `/usage` labels. The batch file ("Decisions") now carries the real shape, the labels "Current session", "Current week (all models)" and "Current week (<Model>)", the token field and the request headers. It is a change of the plan, not a departure from the spec. The coverage table is unchanged.
- **Names.** The new components say "plan" and the button is "Plan Usage", because "usage" already means the context, tokens and cost of a session.
- **Placement.** The usage button sits right after the theme switch.
- **Tests.** Vitest and browser Playwright only. No Electron e2e (knowledge base `electron-e2e-separate`). The batch file lists the existing tests to run (knowledge base `narrow-batch-tests`).

## Departures

None. The human decisions of the requirements step (REQ-14 kept, the data source) are in the spec or add to it. None contradicts it.

## Coverage check

Every REQ is served by at least one INT. Every INT serves at least one REQ. There is no enabling intervention. Every REQ closes in `plan-usage-view`, the only batch.

| REQ | INT (all in `batch-plan-usage-view`) | Closes in |
|-----|--------------------------------------|-----------|
| REQ-1 | INT-1, INT-13, INT-14 | plan-usage-view |
| REQ-2 | INT-13, INT-14 | plan-usage-view |
| REQ-3 | INT-11, INT-15 | plan-usage-view |
| REQ-4 | INT-11, INT-15 | plan-usage-view |
| REQ-5 | INT-2, INT-10, INT-12 | plan-usage-view |
| REQ-6 | INT-2, INT-10, INT-12 | plan-usage-view |
| REQ-7 | INT-2, INT-10, INT-12 | plan-usage-view |
| REQ-8 | INT-10 | plan-usage-view |
| REQ-9 | INT-7, INT-10 | plan-usage-view |
| REQ-10 | INT-10 | plan-usage-view |
| REQ-11 | INT-4, INT-5, INT-6, INT-8 | plan-usage-view |
| REQ-12 | INT-8 | plan-usage-view |
| REQ-13 | INT-3, INT-4, INT-5, INT-6, INT-9, INT-12 | plan-usage-view |
| REQ-14 | INT-4, INT-5, INT-9, INT-12 | plan-usage-view |
| REQ-15 | INT-10, INT-11, INT-12, INT-13 | plan-usage-view |
| REQ-16 | INT-10, INT-11, INT-13 | plan-usage-view |
| REQ-17 | INT-4, INT-5, INT-8, INT-12 | plan-usage-view |
| REQ-18 | INT-2, INT-3, INT-4 | plan-usage-view |

Every REQ appears in the `REQ` line of at least one acceptance scenario of the batch.
