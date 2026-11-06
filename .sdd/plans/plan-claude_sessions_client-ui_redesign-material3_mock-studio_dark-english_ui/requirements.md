---
slug: claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui
date: 2026-11-06
spec: .sdd/analysis/claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui.md
status: validated
---

# Requirements — English user interface

"The mock" is `.sdd/mockups/studio-dark/mock.html`. "UI text" is every text of the client that the user sees or hears.

## Feature: English user interface

| ID | Requirement |
|----|-------------|
| REQ-1 | Titles, labels, buttons, tooltips, placeholders, badges, chips and hints are in English. |
| REQ-2 | The four session states ("Lavora", "Richiede input", "In attesa", "Terminata") show four distinct English names. |
| REQ-3 | Every action has an English name, including the current "Nuova sessione", "Riprendi", "Riprendi qui", "Interrompi", "Termina", "Rispondi" and "Annulla". |
| REQ-4 | Dialog titles, texts and fields, the confirmations and the running-elsewhere warning are in English. |
| REQ-5 | Empty, loading and error states, error messages and snackbars are in English. |
| REQ-6 | Counters are in English and use the singular for one and the plural otherwise, for example "1 needs input" and "3 new messages". |
| REQ-7 | Relative times and dates use English words. |
| REQ-8 | Times keep the 24-hour clock. |
| REQ-9 | Accessibility labels, such as the names of icon buttons read by screen readers, are in English. |
| REQ-10 | The page title in the browser tab is in English. |
| REQ-11 | The page declares English as its language, so screen readers read it with English pronunciation. |
| REQ-12 | The message name lines read "You" and "Claude". |
| REQ-13 | Where the mock shows an English text for an element that exists in the client, the client shows that text. |
| REQ-14 | No Italian text remains in the UI, also in states that show rarely, such as error cases. |
| REQ-15 | At the 1280 px minimum width every English text fits its element, with no overflow and no change to the compact layout of the reference. |
| REQ-16 | The outcomes of a tool card ("Fatto", "Fallito") show English names. |

## Assumptions

These are not human decisions. Each one applies the spec. The gatekeeper gave them, except "Tool outcomes": the planner added it after reading the component specs.

- **State names.** "Lavora" → "Running", "Richiede input" → "Needs Input", "In attesa" → "Idle", "Terminata" → "Ended". The mock uses "Running" for the same state, so REQ-13 requires it. The mock's "Idle / Completed" and "Waiting Approval" do not map one to one onto the client's states, so the other three states get plain English. "Needs input" follows the spec's counter example.
- **Tool outcomes.** The spec lists "Fallito" with the session states. In the client it is the failed outcome of a tool card, and there are four session states (StateBadge spec). The mock's tool card shows "completed" and "error", so REQ-13 gives "Fatto" → "Completed" and "Fallito" → "Error", with capitals by the rule below.
- **Claude's name line.** It reads "Claude", not the mock's "Claude Code". The spec names this text, so it wins over REQ-13.
- **Capitals.** Titles, buttons, labels, tooltips, chips and state names use Title Case, as the mock does. Sentences, hints, messages, errors and counters use sentence case, for example "1 needs input".

## Constraints on the whole plan

These are not REQs: they apply to every REQ above, so no single intervention closes them.

- Only the text changes. No behaviour, layout or style changes.
- English replaces Italian completely. There is no language switch and no second language.
- Out of scope: the content of Claude conversations, texts that Claude Code produces and the client shows as they are (such as terminal output), logs, code identifiers and code comments.
- The mock's extra features stay out, as in the reference plan.
- Every requirement of `plan-claude_sessions_client`, `plan-claude_sessions_client-ui_redesign`, `plan-claude_sessions_client-ui_redesign-material3_mock` and `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark` stays true. Where they quote an Italian UI text, they now mean its English text from this plan. This plan changes: the constraint "UI texts stay the current Italian ones" and the name line "Tu" of `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark` (REQ-12, REQ-13).
