---
request_slug: session_usage
date: 2026-11-06
type: evolution
size: ordinary
reference: .sdd/analysis/claude_sessions_client.md
---

# Analysis — Context, tokens and cost per session

## Request

> Contesto, token e costi per sessione. Per ogni sessione (ospitata ed esterna) il client mostra quanto della finestra di contesto è occupato, i token consumati e il costo stimato, letti dal campo usage dei transcript JSONL di Claude Code che il client legge già.

## Reference

[claude_sessions_client.md](claude_sessions_client.md) → the client that lists hosted and external Claude Code sessions. It put "Token usage and cost reports" out of scope (line 163). A list entry shows the project folder, the label, the state and the last activity (line 47). A working entry also shows the running tool ([session_list_improvements.md](session_list_improvements.md), line 51).

Changes:
- Each session, hosted or external, shows its context occupancy, the tokens it consumed and its estimated cost.
- Usage and cost of a single session move into scope. Reports across sessions stay out.
- Every other requirement of the reference stays true.

## Summary

For each hosted and external session, the client shows how full the context window is, how many tokens the session used, and what it costs at API list prices. The figures come from the `usage` field of the Claude Code transcripts.

## Requirements

### Functional

Where
- The list entry of every session, hosted or external, in any state, must show the context occupancy as a percentage and the estimated cost.
- The header of the open session must show the context occupancy, the tokens consumed and the estimated cost in full detail.

Context
- The context occupancy must be the input of the last response of the main conversation: input tokens plus cache write tokens plus cache read tokens. Output tokens do not count.
- The header must show the occupancy as used tokens out of the window size and as a percentage, for example "45.2k / 200k · 23%".
- The window size must be the one of the model that the session uses now.
- Subagent responses must not change the context occupancy.
- After a compaction, the occupancy must show no value until the next response of the main conversation.
- The occupancy must stand out at 70% and stand out more at 90%.

Tokens
- The tokens consumed must be the sum over all responses of the session, from the main conversation and from its subagents.
- The header must show the total and its four parts: input, output, cache write, cache read.
- Each response must count once, with its final values, also when the transcripts repeat it on several lines or in several files.
- A resumed session must include its responses from before the resume.
- After `/clear`, tokens and cost must start again from zero, as Claude Code's own session totals do.

Cost
- The estimated cost must price each response with the list prices of its own model, in USD.
- The prices must cover five categories: input, 5-minute cache write, 1-hour cache write, cache read, output.
- A response must use the price tier of its own prompt length when its model has tiers, for example Haiku 5.5 above 100,000 tokens.
- The cost must be labelled as an estimate at API list prices.
- When a response has a model with no known price, its tokens must still count and the cost must carry an "incomplete" mark.

States and format
- Before the first response, and when no `usage` can be read, the session must show no figures, not zeros.
- An ended session must keep its last figures.
- Token counts must use a short form: 950, 45.2k, 1.3M.
- A cost must show two decimals, for example "$1.27", and "<$0.01" below one cent.
- Every new text must be in English, like the rest of the UI.

### Non-functional

- The figures must update within 2 seconds of a new response in the transcript, for hosted and external sessions.
- A transcript with thousands of responses must not slow down the list or the opening of a session.

## Assumptions

- This is an evolution, not a fix. The reference left token and cost reports out on purpose (line 163). The orchestrator decided this.
- The list entry shows only the percentage and the cost, to stay short. The request does not say where the figures go.
- The cost is shown to every user, subscribers included. Claude Code does the same and says the figure is not a bill for subscribers ([costs](https://code.claude.com/docs/en/costs)).
- The transcript does not record the window size. The size follows Claude Code: 200,000 tokens by default, 1,000,000 for extended-context models ([status line](https://code.claude.com/docs/en/statusline)).
- An occupancy above 200,000 tokens means the window is 1,000,000.
- The 70% and 90% levels come from the context bar example in the Claude Code status line docs.
- Prices are Anthropic's public list prices on the delivery date ([pricing](https://platform.claude.com/docs/en/about-claude/pricing)).
- Cache writes with no recorded duration are priced as 5-minute writes, the lower price.
- Subagent tokens count, because their requests use the plan or the bill like the main ones ([costs](https://code.claude.com/docs/en/costs)).

## Market trends

- Claude Code shows the cost of the current session in `/usage` and in the status line. It computes it locally at list price and calls it an estimate ([costs](https://code.claude.com/docs/en/costs)).
- The status line defines context use as input plus cache write plus cache read of the last call, without output ([status line](https://code.claude.com/docs/en/statusline)).
- Community tools such as ccusage and ccmetrics sum the transcript `usage`. Their known faults are double counts of repeated lines and missed subagent files ([DEV Community](https://dev.to/gabrielanhaia/summing-claude-codes-transcript-usage-one-api-response-can-appear-several-times-15g7), [ccmetrics](https://docs.rs/crate/ccmetrics/latest)).
- What this means: Claude Code shows these figures only inside each terminal, one session at a time. The client shows them for all sessions in one place.

## Risks

- The `usage` field and the transcript layout are not documented. A new Claude Code version can break or skew the figures.
- A wrong window size gives a wrong percentage. A 1M session at 150k tokens would show 75% instead of 15%.
- Repeated transcript lines carry early output counts. Counting the wrong line gives too few output tokens.
- Subagent transcripts can live in separate files. Missing them gives too low tokens and cost.
- Prices change and new models appear. An old price list gives a wrong or incomplete cost.
- A subscriber can read the cost as a real charge.

## Scope

In scope:
- Context occupancy, tokens consumed and estimated cost of each hosted and external session, in its list entry and in its header.

Out of scope:
- Totals across sessions, per project, per day or per period, and charts of usage over time.
- Plan limits and quota windows, such as the 5-hour and weekly limits.
- Budgets, alerts and notifications on cost or context.
- Actions on the context from the client, such as `/compact` or `/clear`.
- Usage figures in the resume history.
- Contract rates, fast mode, data residency, batch prices and fees of server tools such as web search.
- A breakdown of what fills the context, as `/context` shows it.
