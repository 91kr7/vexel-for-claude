---
request_slug: usage_limits
date: 2026-11-09
type: evolution
size: ordinary
reference: .sdd/analysis/session_usage.md
---

# Analysis — Plan usage limits view

## Request

> implementa un tasto affianco a quello del tema per mostrare lo usage di claude. di fatto mostra cio' che /usage fa! mi serve per vedere quando sto consumando delle soglie settimane e oraria

## Reference

[session_usage.md](session_usage.md) → context, tokens and cost of each session. It put "Plan limits and quota windows, such as the 5-hour and weekly limits" out of scope. [light_theme.md](light_theme.md) added the Light/Dark switch in the top bar.

Changes:
- Plan limits move into scope: the 5-hour window and the weekly limit.
- Figures per session stay as in the reference.

## Summary

Add a button next to the theme switch. It opens a view of what `/usage` shows about the plan limits: how much of the current 5-hour window and of the weekly limit is used, and when each one resets.

## Requirements

### Functional

- The top bar must show a usage button next to the theme switch.
- The button must have an accessible name and work with the keyboard, with a visible focus, like the other controls.
- Using the button must open a view of the plan usage, and using it again or closing the view must hide it.
- Opening the view must not interrupt sessions, close dialogs, or lose the open session or the scroll position.
- The view must show the current session limit, the 5-hour window, with the percentage used and the reset time.
- The view must show the weekly limit with the percentage used and the reset time.
- When `/usage` shows more than one weekly limit, for example one per model, the view must show each of them with its own percentage and reset time.
- Each limit must show its percentage as a number and as a bar.
- A reset time must be shown as a time remaining and as a date and time.
- A limit near its threshold must stand out at 70% and stand out more at 90%.
- The figures must be current when the view opens, and must refresh while the view stays open.
- When plan limits are not available, the view must say so and must show no figures, not zeros.
- When the figures cannot be refreshed, the view must say so and must not present the old figures as current.
- Every new text must be in English, like the rest of the UI.
- The button and the view must look right in both the light and the dark theme.

### Non-functional

- The view must open without blocking the client while the figures load, and must show that it is loading.
- The figures must agree with what `/usage` shows for the same account at the same moment.

## Assumptions

- This is an evolution, not a fix. The reference left plan limits out of scope. The orchestrator decided this.
- "Soglia oraria" means the 5-hour session window that `/usage` shows. The client has no other hourly limit to show.
- The view shows only plan limits. The activity statistics and the breakdown of what used the limit, which `/usage` also shows, stay out.
- The button sits in the top bar next to the theme switch, because the request says so.
- The view is opened on demand. It does not open by itself.
- The 70% and 90% levels are the same as the context levels of the reference, so the client uses one rule for "near a limit".
- The reset time is the one Anthropic reports. The client does not compute it, because sources disagree on how the weekly reset works ([guide](https://alexcloudstar.com/blog/claude-code-usage-limits-2026/), [issue](https://claudeissues.com/issue/30933-weekly-usage-limit-doesnt-reset-at-the-displayed-time)).
- The limits are shared with Claude chat and Claude Desktop, so the view can show use that did not come from this client ([guide](https://alexcloudstar.com/blog/claude-code-usage-limits-2026/)).
- Some sign-in types have no plan limits, for example an API key ([costs](https://code.claude.com/docs/en/costs)). They get the "not available" state.

## Risks

- The data behind `/usage` is not a documented public contract. A new Claude Code version can change it or break the view.
- A reset time shown wrongly sends the user to stop work at the wrong moment.
- A stale figure can make a limit look safe when it is not.

## Scope

In scope:
- A usage button next to the theme switch.
- A view of the 5-hour and weekly plan limits, with percentage used and reset time.
- The "not available" state.

Out of scope:
- Alerts and notifications when a limit is near or reached.
- Activity statistics and the breakdown of usage, as `/usage` shows them.
- History or charts of limit use over time.
- Tokens and cost per session, which stay as in the reference.
- Any action on the limits, such as buying more usage or changing plan.
- A setting for the levels or for how often the figures refresh.
