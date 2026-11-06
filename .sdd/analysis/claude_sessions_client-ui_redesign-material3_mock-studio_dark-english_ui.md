---
request_slug: claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui
date: 2026-11-06
type: evolution
size: narrow
reference: .sdd/analysis/claude_sessions_client-ui_redesign-material3_mock-studio_dark.md
---

# Analysis — English user interface

## Request

> traduci tutta l'app in inglese!!!!

## Reference

[claude_sessions_client-ui_redesign-material3_mock-studio_dark.md](claude_sessions_client-ui_redesign-material3_mock-studio_dark.md) → the dark "Studio" restyle of the client. It kept every UI text in Italian and did not use the mock's English texts (its line 42).

Changes:
- The UI language becomes English. Italian goes away.
- Where the Studio mock shows an English text for the same element, that text is used.
- Every other requirement of the reference stays true.

## Summary

Translate every text of the client that the user sees or hears from Italian to English. Only the text changes.

## Requirements

### Functional

- Every UI text must be in English: titles, labels, buttons, tooltips, placeholders, badges, chips and hints.
- The session states must be in English: "Lavora", "Richiede input", "In attesa", "Terminata" and "Fallito" become their English names.
- Actions must be in English, for example "Nuova sessione", "Riprendi", "Riprendi qui", "Interrompi", "Termina", "Rispondi" and "Annulla".
- Dialogs, confirmations and the running-elsewhere warning must be in English.
- Empty, loading and error states, error messages and snackbars must be in English.
- Counters must be in English with correct singular and plural, for example "1 needs input" and "3 new messages".
- Relative times and dates must use English words.
- Accessibility labels and the page title must be in English.
- The message name lines must read "You" and "Claude".
- No Italian text must remain in the UI.

### Non-functional

- Every text must fit its element in the compact layout of the reference, at the 1280 px minimum width.

## Assumptions

- This is an evolution, not a fix. Italian was a deliberate choice of the reference, so English is new behaviour.
- English replaces Italian completely. There is no language switch, because the request asks to translate, not to add a language.
- "The whole app" means every text the user sees or hears, including accessibility labels and the page title.
- Where the mock `.sdd/mockups/studio-dark/mock.html` has an English text for an element that exists in the client, that text is used. Other texts get a plain, natural English translation.
- The clock stays 24-hour. Only the words around times and dates change.
- Nothing changes except the text: no behaviour, layout or style change.

## Risks

- English texts have a different length. A longer text can overflow the compact rows, chips, badges and buttons of the reference.
- An Italian text shown only in a rare state (an error or an edge case) can be missed.

## Scope

In scope:
- The translation of every user-facing text of the client into English.

Out of scope:
- The content of Claude conversations, because Claude produces it.
- Texts that come from Claude Code itself and are shown as they are, such as terminal output.
- Logs, code identifiers and code comments.
- A language switch or any second language.
- Any change of behaviour, layout or style.
- The mock's extra features, which stay out as in the reference.
