---
slug: session_usage
date: 2026-11-06
spec: .sdd/analysis/session_usage.md
status: validated
---

# Requirements — Context, tokens and cost per session

Words used below:

- "Response" → one answer of the model to one request, with its `usage` field in the transcript.
- "Main conversation" → the responses of the session itself, not those of its subagents.
- "Context occupancy" → how much of the context window the session fills now.
- "Tokens consumed" → the tokens of all the responses of the session.
- "Estimated cost" → the price of the tokens consumed at API list prices.
- "Header" → the header of the open session in the main area.
- "Prompt length" → input plus cache write plus cache read tokens of one response.

## Feature: Context occupancy

| ID | Requirement |
|----|-------------|
| REQ-1 | The list entry of every session, hosted or external, in any state, shows the context occupancy as a percentage. |
| REQ-2 | The header shows the context occupancy as used tokens out of the window size and as a percentage, for example "45.2k / 200k · 23%". |
| REQ-3 | The used tokens are the input, cache write and cache read tokens of the last response of the main conversation, without its output tokens. |
| REQ-4 | The window size is the one of the model of the last response of the main conversation: 1,000,000 tokens for an extended-context model, 200,000 otherwise. |
| REQ-5 | When the used tokens are above 200,000, the window size is 1,000,000. |
| REQ-6 | Subagent responses do not change the context occupancy. |
| REQ-7 | After a compaction, the context occupancy shows no value until the next response of the main conversation. |
| REQ-8 | In the list entry and in the header, the context occupancy stands out from 70% and stands out more from 90%. |
| REQ-9 | Before the first response of the main conversation, and when no `usage` can be read, the session shows no context occupancy, not 0%. |
| REQ-10 | An ended session keeps its last context occupancy. |
| REQ-11 | Token counts use a short form: 950, 45.2k, 1.3M. |
| REQ-12 | The context occupancy updates within 2 seconds of a new response of the main conversation, for hosted and external sessions. |

## Feature: Tokens consumed

| ID | Requirement |
|----|-------------|
| REQ-13 | The header shows the tokens consumed: the total and its four parts input, output, cache write and cache read. |
| REQ-14 | The tokens consumed are the sum over all the responses of the session, from the main conversation and from its subagents. |
| REQ-15 | Each response counts once, with its final values, also when the transcripts repeat it on several lines or in several files. |
| REQ-16 | A resumed session includes its responses from before the resume. |
| REQ-17 | After `/clear`, the tokens consumed start again from zero. |
| REQ-18 | Before the first response, and when no `usage` can be read, the session shows no tokens consumed, not zeros. |
| REQ-19 | An ended session keeps its last tokens consumed. |
| REQ-20 | The tokens consumed update within 2 seconds of a new response, of the main conversation or of a subagent, for hosted and external sessions. |
| REQ-21 | A transcript with thousands of responses does not slow down the list or the opening of a session. |

## Feature: Estimated cost

| ID | Requirement |
|----|-------------|
| REQ-22 | The list entry of every session, hosted or external, in any state, shows the estimated cost. |
| REQ-23 | The header shows the estimated cost. |
| REQ-24 | The estimated cost prices the same responses that the tokens consumed count. |
| REQ-25 | Each response is priced in USD with the list prices of its own model. |
| REQ-26 | The prices cover five categories: input, 5-minute cache write, 1-hour cache write, cache read and output. |
| REQ-27 | A cache write with no recorded duration is priced as a 5-minute cache write. |
| REQ-28 | When the model of a response has price tiers, the response uses the tier of its own prompt length, for example Haiku 5.5 above 100,000 tokens. |
| REQ-29 | The estimated cost is labelled as an estimate at API list prices. |
| REQ-30 | When a response has a model with no known price, the estimated cost carries an "incomplete" mark. |
| REQ-31 | A response with a model with no known price still counts in the tokens consumed. |
| REQ-32 | A cost shows two decimals, for example "$1.27", and "<$0.01" below one cent. |
| REQ-33 | Before the first response, and when no `usage` can be read, the session shows no estimated cost, not "$0.00". |
| REQ-34 | An ended session keeps its last estimated cost. |
| REQ-35 | The estimated cost updates within 2 seconds of a new response, for hosted and external sessions. |

## Assumptions

The gatekeeper confirmed "Window size", "Label of the cost", "Incomplete cost" and "Stand out" on 2026-11-06. The others apply the spec.

- **Window size (REQ-4).** A fixed table gives the window size of each known model id. A "[1m]" marker in the model id also means 1,000,000. Any other model gets 200,000. REQ-5 is the fallback for the cases the table misses.
- **Percentage (REQ-1, REQ-2).** The percentage is rounded to the nearest whole number, as in "23%".
- **Short form (REQ-11).** Below 1,000 → the plain number. From 1,000 → thousands with one decimal and "k". From 1,000,000 → millions with one decimal and "M". A trailing ".0" is dropped, as in "200k" and "1M".
- **Stand out (REQ-8).** From 70% the occupancy uses the warning colour of the theme. From 90% it uses the error colour.
- **Label of the cost (REQ-29).** The header shows the label as text. The list entry is short, so it shows the label as a tooltip on the cost.
- **Incomplete cost (REQ-30).** The cost sums the responses with a known price, and the mark tells that some are missing. The tooltip of the mark says that the price of a model is unknown. When no response has a known price, the cost shows "—" with the mark, because "<$0.01" would read as a real figure.
- **Prompt length (REQ-28).** It is the definition used by Anthropic's long-context prices.
- **Prices (REQ-25 to REQ-28).** They are Anthropic's public list prices on the delivery date, as the spec says.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- Every new text of the UI is in English.
- The client only reads the Claude Code transcripts. It writes nothing to them.
- Out of scope: totals across sessions, per project, per day or per period; charts of usage over time; plan limits and quota windows; budgets, alerts and notifications on cost or context; actions on the context such as `/compact` or `/clear`; usage figures in the resume history; contract rates, fast mode, data residency, batch prices and server tool fees; a breakdown of what fills the context.
- Every requirement of `plan-session_list_improvements` and of the plans before it stays true.
