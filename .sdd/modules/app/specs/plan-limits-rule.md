---
module: app
component: planLimitsOf
type: backend function
---

# planLimitsOf

**Purpose** → turns the body of the Anthropic usage answer into the list of plan limits that `/usage` shows.

## Contract

- `planLimitsOf(body) → PlanLimit[]`, with `PlanLimit = { label, percent, resetsAt }`.
  - `label` → text, `percent` → whole number (rounded to the nearest), `resetsAt` → ISO 8601 text, or `null` when the answer gives none.
- `body.limits` is a non-empty array → one limit per row, in the order of the array:
  - `kind: "session"` → label "Current session".
  - `kind: "weekly_all"` → label "Current week (all models)".
  - `kind: "weekly_scoped"` with a non-empty text `scope.model.display_name` → label "Current week (<display_name>)". Every such row is listed, 0% included.
  - values come from `percent` (0 to 100) and `resets_at`.
  - a row of another `kind`, a `weekly_scoped` row with no model name, a row whose `percent` is not a finite number, or a row that is not an object gives nothing.
- `body.limits` is missing, empty, or gives no limit → the fallback keys, in this order, each with `utilization` (0 to 100) and `resets_at`:
  - `five_hour` → "Current session"
  - `seven_day` → "Current week (all models)"
  - `seven_day_opus` → "Current week (Opus)"
  - `seven_day_sonnet` → "Current week (Sonnet)"
  - a key that is null, missing or without a finite `utilization` gives nothing. No other `seven_day_*` key is read.
- a body that is not an object → `[]`.

## Rules and invariants

- Pure: no I/O, no clock.
- The labels are those of `/usage` (Claude Code 2.1.319). Gatekeeper decision, 2026-11-09, after the check on the real account: the real answer lists model limits only in `limits`, and the keys `seven_day_oauth_apps`, `seven_day_cowork` and `seven_day_omelette` are not models.
- Gatekeeper decision, 2026-11-09: every model row shows. `/usage` hides some by an internal allowlist that the client cannot reproduce.
- The endpoint is not a documented contract: a new Claude Code version can change the answer.

## Requirements served

- `plan-usage_limits/REQ-5`, `plan-usage_limits/REQ-6`, `plan-usage_limits/REQ-7`, `plan-usage_limits/REQ-18`
