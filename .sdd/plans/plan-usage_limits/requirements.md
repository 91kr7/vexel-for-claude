---
slug: usage_limits
date: 2026-11-09
spec: .sdd/analysis/usage_limits.md
status: validated
---

# Requirements — Plan usage limits view

Words used below:

- "Usage button" → the top-bar button that opens and closes the usage view.
- "Usage view" → the view of the plan limits that the button opens.
- "Limit" → one plan limit that `/usage` shows: the 5-hour session limit, or a weekly limit.
- "Not available" → the state of an account that has no plan limits, for example an API key, or whose limits cannot be read.

## Feature: Plan usage view

| ID | Requirement |
|----|-------------|
| REQ-1 | The top bar shows a usage button next to the theme switch. |
| REQ-2 | The usage button has an accessible name, works with the keyboard and shows a visible focus, like the other controls of the top bar. |
| REQ-3 | Using the usage button opens the usage view. Using it again, or closing the view, hides it. |
| REQ-4 | Opening the usage view does not interrupt sessions, does not close dialogs, and does not lose the open session or its scroll position. |
| REQ-5 | The usage view shows the session limit, the 5-hour window, with the percentage used and the reset time. |
| REQ-6 | The usage view shows the weekly limit with the percentage used and the reset time. |
| REQ-7 | When `/usage` shows more than one weekly limit, for example one per model, the usage view shows each of them with its own percentage and reset time. |
| REQ-8 | Each limit shows its percentage as a number and as a bar. |
| REQ-9 | A reset time is shown as a time remaining and as a date and time. |
| REQ-10 | A limit stands out from 70% and stands out more from 90%. |
| REQ-11 | The figures are current when the usage view opens. |
| REQ-12 | The figures refresh while the usage view stays open. |
| REQ-13 | When plan limits are not available, the usage view says so and shows no figures, not zeros. |
| REQ-14 | When the figures cannot be refreshed, the usage view says so and does not present the old figures as current. |
| REQ-15 | Every new text of the usage button and of the usage view is in English. |
| REQ-16 | The usage button and the usage view look right in the light and in the dark theme. |
| REQ-17 | The usage view opens without blocking the client while the figures load, and shows that it is loading. |
| REQ-18 | The figures agree with what `/usage` shows for the same account at the same moment. |

## Assumptions

REQ-14 comes from the risk "A stale figure can make a limit look safe when it is not". The human decided on 2026-11-09 to keep it as a requirement, and the spec now carries it. The refresh interval and the shape of the view are gatekeeper decisions of the same date. The other REQs apply the spec.

- **Level of REQ-10.** The same levels as the context occupancy of `plan-session_usage`: "stands out" from 70% and "stands out more" from 90%, using the warning and the error colours of the theme. The percentage is a whole number, rounded to the nearest, as in "23%". The levels apply to the rounded value.
- **Refresh of REQ-12.** The refresh interval is fixed, 60 seconds. The spec does not set it and puts a setting for it out of scope. A long interval also protects the source of the figures from too many requests.
- **Current figures (REQ-11).** Opening the view reads the figures again. The view never shows the figures of an earlier opening as current.
- **Not available (REQ-13, REQ-14).** The two states are different. "Not available" is an account with no plan limits, for example an API key, or one whose limits cannot be read at all. A failed refresh after figures were shown is REQ-14.
- **Shape of the view.** It is a popover anchored to the usage button, not a modal dialog that stops the rest of the client. There is no mock. REQ-4 sets the effect, the design follows the look of the existing panels.
- **Source of the figures (REQ-18).** Human decision, 2026-11-09. A backend service reads the sign-in token, read-only, from the Claude Code folder, and calls the same Anthropic usage endpoint that `/usage` uses. A missing token or a failed read gives "not available". This is an exception to the rule of the module `history` that the client reads no credentials. The token is never written, logged or sent to the browser, and goes to no other address.
- **Names.** "Session limit" and "weekly limit" follow the words of the spec and of `/usage`. The client uses no other name for them.
- **Out of scope**, as in the spec: alerts and notifications, activity statistics and the breakdown of usage, history or charts, tokens and cost per session, actions on the limits, and a setting for the levels or the refresh.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- The client only reads the figures of the plan limits. It changes nothing in the account or in the Claude Code folder.
- Every requirement of `plan-keyboard_shortcuts` and of the plans before it stays true.
