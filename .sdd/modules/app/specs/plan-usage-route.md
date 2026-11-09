---
module: app
component: PlanUsageRoute
type: REST endpoint
---

# PlanUsageRoute

**Purpose** → gives the page the plan limits, without the token.

## Contract

- `GET /api/plan-usage` → always `200`, body one of:
  - `{ status: "ok", limits: [{ label, percent, resetsAt }] }`
  - `{ status: "unavailable" }`
  - `{ status: "error" }`
- the body is the result of `read()` of the PlanLimitsReader. A reader that throws gives `{ status: "error" }`.
- calls that overlap share one `read()`. When it ends, the next call starts a new one: nothing is kept.

## Rules and invariants

- The body never holds the token.
- LocalAccessGuard applies as to every route.

## Dependencies

- PlanLimitsReader, LocalAccessGuard

## Requirements served

- `plan-usage_limits/REQ-11`, `plan-usage_limits/REQ-13`, `plan-usage_limits/REQ-14`, `plan-usage_limits/REQ-17`
