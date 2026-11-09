---
module: app
component: PlanUsageStore
type: frontend hook
---

# PlanUsageStore

**Purpose** → loads the plan limits for the view and keeps them current while it is open.

## Contract

- `usePlanUsage(open) → PlanUsageState`, one of:
  - `{ kind: "loading" }`
  - `{ kind: "ready", limits, readAt }` → `readAt` is the time of the read, in ms.
  - `{ kind: "unavailable" }`
  - `{ kind: "stale", lastReadAt }` → time of the last good read.
- `open` turns `true` → earlier figures are dropped, the state is `loading`, and `GET /api/plan-usage` loads.
- `open` stays `true` → it loads again every 60 s.
- `open` turns `false` → loading stops, a request in flight is aborted, a late answer changes nothing, and the state is `loading` again.
- a good read (`status: "ok"` with at least one valid limit) → `ready`.
- a failed load (network error, status other than 200, `unavailable`, `error`, a body of the wrong shape):
  - before any good read of this opening → `unavailable`.
  - after a good read of this opening → `stale`, with the time of that read, until a good read gives `ready` again.
- the state is `loading` whenever `open` is `false`, so figures of an earlier opening are never shown as current.

## Rules and invariants

- Only the newest request of an opening changes the state.
- The 60 s interval is fixed (gatekeeper decision of the analysis, 2026-11-09). No setting.
- It reads only limits: the page never gets the token.

## Dependencies

- PlanUsageRoute

## Requirements served

- `plan-usage_limits/REQ-11`, `plan-usage_limits/REQ-12`, `plan-usage_limits/REQ-13`, `plan-usage_limits/REQ-14`, `plan-usage_limits/REQ-17`
