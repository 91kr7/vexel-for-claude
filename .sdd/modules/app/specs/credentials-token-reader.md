---
module: app
component: readAccessToken
type: backend service
---

# readAccessToken

**Purpose** → gives the sign-in token of Claude Code, read-only, for the PlanLimitsReader.

## Contract

- `readAccessToken(claudeDir) → Promise<string | undefined>` → opens `<claudeDir>/.credentials.json` and gives `claudeAiOauth.accessToken`.
  - file missing or unreadable, bad JSON, no `claudeAiOauth`, or a token that is not a non-empty text → `undefined`.
  - never throws.

## Rules and invariants

- Human decision, 2026-11-09: this is the exception to the rule of the module `history` that the client reads no credentials. SessionHistory and ExternalSessionCheck still read none, and their specs stay as they are.
- It is the only component that opens `.credentials.json`. It never opens the `<pid>.<hash>.key` files.
- It takes only `claudeAiOauth.accessToken`. The file also holds a refresh token and `mcpOAuth` tokens: they are never read or returned.
- Read-only: the file is never written, and the client never refreshes the token.
- The token is never logged and never put in an error.

## Requirements served

- `plan-usage_limits/REQ-13`, `plan-usage_limits/REQ-18`
