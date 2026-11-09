---
module: app
component: PlanLimitsReader
type: backend service
---

# PlanLimitsReader

**Purpose** → reads the plan limits of the account from the same Anthropic usage endpoint that `/usage` uses.

## Contract

- `new PlanLimitsReader({ claudeDir?, fetch?, timeoutMs? })` → `claudeDir` default `defaultClaudeDir()` of SessionHistory, `fetch` default the global one, `timeoutMs` default 10 000.
- `read() → Promise<PlanLimitsResult>`, never rejects:
  - no token (readAccessToken) → `{ status: "unavailable" }`, with no request.
  - else one `GET https://api.anthropic.com/api/oauth/usage` with `Authorization: Bearer <token>`, `anthropic-beta: oauth-2025-04-20` and `Accept: application/json`, a redirect is an error, limit `timeoutMs`.
  - status `200` and at least one limit from planLimitsOf → `{ status: "ok", limits }`.
  - network error, timeout, any status other than `200`, a body that is not JSON, or no limit at all → `{ status: "error" }`.

## Rules and invariants

- The token goes to no address but the usage endpoint. It is never logged, and never in the result or in an error.
- An expired token gives `error`: the client never refreshes it. Claude Code refreshes the file when it runs.
- `unavailable` means no token, `error` means the call failed.
- Source of the figures and the checks on the real account (2026-11-09): human decision and gatekeeper decision, see credentials token reader and planLimitsOf.

## Dependencies

- readAccessToken, planLimitsOf, SessionHistory (`defaultClaudeDir`, module history)

## Requirements served

- `plan-usage_limits/REQ-11`, `plan-usage_limits/REQ-13`, `plan-usage_limits/REQ-14`, `plan-usage_limits/REQ-17`, `plan-usage_limits/REQ-18`
