---
batch: plan-usage-view
feature: Plan usage view
closed_req: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18]
depends: []
---

# Batch plan-usage-view — Plan usage view

REQ ids refer to `plan-usage_limits/requirements.md`. Read its assumptions "Level of REQ-10", "Refresh of REQ-12", "Not available", "Shape of the view" and "Source of the figures". The paths of the existing components are in `.sdd/modules/app/index.md` and `.sdd/modules/sessions/index.md`.

Naming. The client already uses "usage" for the context, tokens and cost of a session (UsageMonitor, `usage-format`). The new components say "plan" in their names, and the button is named "Plan Usage", so that the two do not mix.

## What this batch builds

- **Plan limits rule** → a pure function: the body of the Anthropic usage answer to the list of limits (label, percentage used, reset time).
- **Credentials token reader** → reads the sign-in token from the Claude Code folder, read-only. The one component that opens `.credentials.json`.
- **Plan limits reader** → a backend service: one call to the Anthropic usage endpoint, with the token, and its result `ok`, `unavailable` or `error`.
- **Plan usage route** → `GET /api/plan-usage`: gives the page the result of the reader.
- **Reset time format** → page functions: the time remaining until a reset, and its date and time.
- **Plan usage store** → page hook: loads the limits when the view opens and every 60 s while it stays open, and gives the view state.
- **Plan limit row** → one limit: label, percentage as a number and as a bar, reset time.
- **Plan usage popover** → the view: a panel anchored to the usage button, with its loading, "not available" and "could not refresh" states.
- **Usage button** → the top-bar icon button "Plan Usage" that opens and closes the popover.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/icons/Icons.tsx` | Add the Lucide "gauge" icon as a decorative SVG component, from the same Lucide version as the set. | REQ-1 | — |
| INT-2 | create | backend, app area | Plan limits rule: the keys `five_hour` and `seven_day` give the session limit and the weekly limit. Each other key `seven_day_<model>` that is not null gives a weekly limit of that model. Null keys give nothing. A body of the wrong shape gives no limit. | REQ-5, REQ-6, REQ-7, REQ-18 | — |
| INT-3 | create | backend, app area | Credentials token reader: opens `<claudeDir>/.credentials.json` read-only and gives the access token. A missing file, bad JSON or no token gives none. It never logs the token or returns it with an error. | REQ-13, REQ-18 | — |
| INT-4 | create | backend, app area | Plan limits reader: no token gives `unavailable`. Else one GET to the usage endpoint with the token, 10 s limit. A 200 gives `ok` and the limits of INT-2. Network error, timeout, other status or no limit at all gives `error`. | REQ-11, REQ-13, REQ-14, REQ-17, REQ-18 | INT-2, INT-3 |
| INT-5 | create | backend, app area | Plan usage route `GET /api/plan-usage`: `200` with `{ status: "ok", limits }`, `{ status: "unavailable" }` or `{ status: "error" }`. Overlapping calls share one request to the endpoint. The body never holds the token. | REQ-11, REQ-13, REQ-14, REQ-17 | INT-4 |
| INT-6 | modify | `src/server/main.ts` | Create the plan limits reader with the default Claude Code folder. Register the plan usage route with it. | REQ-11, REQ-13 | INT-5 |
| INT-7 | create | frontend, app area | Reset time format: time remaining as "2h 15m", "3d 4h" or "<1m", and the reset as local date and time, e.g. "Mon 14 Nov, 18:30". A reset in the past gives "<1m". | REQ-9 | — |
| INT-8 | create | frontend, app area | Plan usage store, hook `usePlanUsage(open)`: when `open` turns true it drops earlier figures, starts as loading and loads `GET /api/plan-usage`. While `open` it loads again every 60 s. When `open` turns false it stops, and a late answer changes nothing. | REQ-11, REQ-12, REQ-17 | — |
| INT-9 | create | frontend, app area | Same store, state of the view: `loading`, `ready` with the limits, `unavailable`, or `stale` with the time of the last good read. A failed first load, `unavailable` and `error` before any figures give `unavailable`. A failed refresh after `ready` gives `stale`. | REQ-13, REQ-14 | INT-8 |
| INT-10 | create | frontend, app area | Plan limit row: label, the whole percentage as a number, a bar of that width with `role="progressbar"`, then "Resets in" the remaining time and the date and time (INT-7). The level (`usageLevelOf` of module sessions: warning 70, error 90) sets the colours of number and bar. | REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-15, REQ-16 | INT-7 |
| INT-11 | create | frontend, app area | Plan usage popover frame: a panel titled "Plan Usage" under the usage button, below the backdrop of any dialog, with a close button. Esc, with the focus on the button or in the panel, closes it. Opening it takes no focus and moves no scroll. | REQ-3, REQ-4, REQ-15, REQ-16 | — |
| INT-12 | create | frontend, app area | Popover content by state (INT-9). `loading` → ProgressIndicator. `ready` → one row (INT-10) per limit. `unavailable` → "Plan usage is not available" and no figures. `stale` → "Could not refresh the plan usage" and the last read time, and no figures. | REQ-5, REQ-6, REQ-7, REQ-13, REQ-14, REQ-15, REQ-17 | INT-9, INT-10, INT-11 |
| INT-13 | create | frontend, app area | Usage button: the ThemeSwitch look with the gauge icon. Accessible name and tooltip "Plan Usage", `aria-expanded` follows the popover, a mouse press does not take the focus. Click, Enter or Space toggles. | REQ-1, REQ-2, REQ-15, REQ-16 | INT-1 |
| INT-14 | modify | `src/web/TopBar.tsx` | Show the usage button right after the ThemeSwitch, 6 px apart, before "New Session". `no-drag` in the desktop window. New props: the open state and the toggle. | REQ-1, REQ-2 | INT-13 |
| INT-15 | modify | `src/web/AppLayout.tsx` | Hold the open state of the popover. The button toggles it, the close button and Esc close it. Render the popover and pass the store state to it. The open session view and any dialog stay as they are. | REQ-3, REQ-4 | INT-8, INT-12, INT-14 |

## Decisions

- **Source (human decision, 2026-11-09).** The reader takes the sign-in token from `<claudeDir>/.credentials.json`, with `defaultClaudeDir()` of SessionHistory, and calls the same Anthropic OAuth usage endpoint that `/usage` uses. The module `history` forbids reading credentials: its specs stay as they are, because SessionHistory and ExternalSessionCheck still do not. The spec of the credentials token reader records this exception as a human decision. It is the only component that opens that file. It never opens the `<pid>.<hash>.key` files.
- **Token handling.** Read-only. Never written, never logged, never in an error text, never in a route body, never sent to any address but the usage endpoint. The page receives limits only.
- **Checks on the real account, before the tests.** The endpoint is not a documented contract (spec risk). The developer checks four points with the machine's own account: the path and field name of the token, the keys of the answer, the scale of the percentage (0 to 100 or a fraction), and the format of the reset time. A fifth check compares the labels with the text of `/usage`. The labels are "Session (5 hours)" for the 5-hour limit, "Weekly (all models)" for `seven_day`, and "Weekly (<Model>)" for each model, unless `/usage` words them otherwise. If a point does not hold, the batch stops and asks the human.
- **Expired token.** The client never refreshes the token. An expired token gives `error`, so "not available" at the first read. Claude Code refreshes the file when it runs.
- **Statuses.** `unavailable` means no token. `error` means the call failed. The page shows both as "not available" on the first read, and a failed refresh after figures as "could not refresh" (REQ-13, REQ-14).
- **Refresh.** The page loads on open and every 60 s while open. The server keeps no cache: overlapping calls share one request. The remaining time is computed again at each load.
- **Placement.** The usage button sits right after the ThemeSwitch: the order is shortcuts, theme, usage, "New Session". It has no keyboard shortcut: the spec asks for none.
- **Popover.** No mock. It uses the look of the existing panels: `.vx-surface-1`, `--border-subtle`, the status tokens for the levels. It does not trap the focus and does not close on a click outside, so a click in the terminal keeps working. It sits below the backdrop of dialogs.
- **Reuse.** `usageLevelOf` of `src/web/sessions/usage-format.ts` is used as it is. `shortTokens`, `percentOf` and the tokens-and-cost figures are not touched.
- **Tests.** Vitest for INT-2 to INT-5, INT-7 to INT-10 and INT-13: fake `fetch`, a temporary Claude folder with a fake `.credentials.json`, fake timers. INT-3 and INT-4 have a test that no log line, result or error holds the token. Playwright e2e in the browser: the test replaces `GET /api/plan-usage` with `page.route`. There is no fake Anthropic server, because the client never sends the token anywhere else. No Electron e2e (knowledge base `electron-e2e-separate`).
- **Existing tests to run** (knowledge base `narrow-batch-tests`). Vitest: `src/server/main.test.ts`, `src/web/icons/Icons.test.tsx`, `src/web/ThemeSwitch.test.tsx`, `src/web/ShortcutsButton.test.tsx`. e2e of the top bar and the page frame: `e2e/light-theme.spec.ts`, `e2e/shortcuts-panel.spec.ts`, `e2e/title-bar.spec.ts`, `e2e/page-frame.spec.ts`, `e2e/layout.spec.ts`, `e2e/english-ui.spec.ts`.

## Human acceptance

### Scenario: The user sees the 5-hour and weekly limits

- REQ → REQ-1, REQ-3, REQ-5, REQ-6, REQ-8, REQ-9, REQ-11, REQ-15
- Given → the client is open, signed in with a plan account
- When → the user clicks the gauge button next to the Light/Dark switch
- Then → a "Plan Usage" panel opens under the button with a "Session (5 hours)" row and a "Weekly (all models)" row
- And → each row shows its percentage as a number and as a bar, the time remaining and the date and time of the reset

### Scenario: The figures match /usage

- REQ → REQ-18
- Given → the usage panel is open
- When → the user runs `/usage` in Claude Code on the same account
- Then → the percentages and the reset times of the panel are the same

### Scenario: A weekly limit per model shows on its own

- REQ → REQ-7
- Given → `/usage` shows a weekly limit for one model besides the weekly limit of all models
- When → the user opens the usage panel
- Then → the panel shows one more row for that model, with its own percentage and reset time

### Scenario: A limit near its threshold stands out

- REQ → REQ-10
- Given → one limit is at 75% and another at 93%
- When → the user opens the usage panel
- Then → the first shows its number and bar in amber, the second in rose

### Scenario: The panel opens and closes without touching the work

- REQ → REQ-3, REQ-4
- Given → a hosted session is working, its terminal is scrolled up, and the terminal has the focus
- When → the user clicks the gauge button, then clicks it again
- Then → the panel opens, then closes, and the session kept working
- And → the terminal still has the focus at the same scroll position

### Scenario: The user uses the button with the keyboard

- REQ → REQ-2, REQ-3
- Given → the client is open
- When → the user moves the focus to the gauge button with Tab, presses Enter, then Esc
- Then → the button shows a visible focus and a name "Plan Usage", the panel opens, then closes

### Scenario: The panel shows that it is loading

- REQ → REQ-17
- Given → the answer of the plan limits is slow
- When → the user opens the usage panel and uses the rest of the client
- Then → the panel shows "Loading…", and the rest of the client keeps responding

### Scenario: The figures refresh while the panel stays open

- REQ → REQ-11, REQ-12
- Given → the usage panel is open and shows a limit at 40%
- When → the limit goes to 45% and about a minute passes
- Then → the panel shows 45% with no action of the user

### Scenario: Plan limits are not available

- REQ → REQ-13
- Given → the account has no plan limits, for example an API key
- When → the user opens the usage panel
- Then → the panel says "Plan usage is not available", and shows no row and no "0%"

### Scenario: A failed refresh does not look current

- REQ → REQ-14
- Given → the usage panel is open with figures, and the figures cannot be read at the next refresh
- When → the refresh fails
- Then → the panel says "Could not refresh the plan usage" with the time of the last read, and shows no figures

### Scenario: The panel reads well in both themes

- REQ → REQ-15, REQ-16
- Given → the client shows the light theme, and then the dark theme
- When → the user opens the usage panel in each
- Then → the button, the panel, the bars and the levels are readable in both, and every text is in English
