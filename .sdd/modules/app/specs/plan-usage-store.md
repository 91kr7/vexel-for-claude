---
module: app
component: PlanUsageStore
type: frontend hook
---

# PlanUsageStore

**Purpose** → loads the plan limits once each time the view opens.

## Contract

- `usePlanUsage(open) → PlanUsageState`, one of:
  - `{ kind: "loading" }`
  - `{ kind: "ready", limits, readAt }` → `readAt` is the time of the read, in ms.
  - `{ kind: "unavailable" }`
- `open` turns `true` → earlier figures are dropped, the state is `loading`, and `GET /api/plan-usage` loads.
- `open` stays `true` → nothing loads again: one request per opening, no periodic refresh.
- `open` turns `false` → loading stops, a request in flight is aborted, a late answer changes nothing, and the state is `loading` again.
- a good read (`status: "ok"` with at least one valid limit) → `ready`.
- a failed load (network error, status other than 200, `unavailable`, `error`, a body of the wrong shape) → `unavailable`.
- the state is `loading` whenever `open` is `false`, so figures of an earlier opening are never shown as current.

## Rules and invariants

- One request per opening, so the usage endpoint is not hit again while the view stays open (human decision, 2026-11-10: the endpoint answered 429 under the 60 s refresh). Closing and opening the view loads again. No setting.
- It reads only limits: the page never gets the token.

## Dependencies

- PlanUsageRoute

## Requirements served

- `plan-usage_limits/REQ-11`, `plan-usage_limits/REQ-13`, `plan-usage_limits/REQ-17` (REQ-12 and REQ-14 are superseded, see `requirements.md`)
