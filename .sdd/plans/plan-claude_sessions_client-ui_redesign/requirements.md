---
slug: claude_sessions_client-ui_redesign
date: 2026-11-05
spec: .sdd/analysis/claude_sessions_client-ui_redesign.md
status: validated
---

# Requirements — UI/UX redesign of the Claude sessions client

## Feature: Visual language and keyboard use

One look for the whole client, in two themes, usable with the keyboard. REQ-1, REQ-3, REQ-4 and REQ-5 cover every screen, so they close only when the last screen is redesigned.

| ID | Requirement |
|----|-------------|
| REQ-1 | Every screen and dialog of the client uses the same colours, type, spacing, icons and component styles. |
| REQ-2 | The client uses a light theme when the operating system is set to light and a dark theme when it is set to dark, and it switches when that setting changes. |
| REQ-3 | In both themes, text and state indicators meet the WCAG 2.2 AA contrast ratios. The content that Claude Code draws in the terminal of a hosted session is excluded. |
| REQ-4 | Every action of the client can be reached and triggered with the keyboard alone. |
| REQ-5 | The element that has the keyboard focus is always visibly marked. |
| REQ-6 | The pages load no font, icon, image or style from a server outside the client. |
| REQ-7 | Each font, icon or image taken from outside the project has a licence that allows its use in this project, and the project records that licence. |

## Feature: Layout

| ID | Requirement |
|----|-------------|
| REQ-8 | The session list and the open session are visible side by side. |
| REQ-9 | When no session is open, the main area shows an empty state with the actions to start a session and to resume a session. |
| REQ-10 | With a window from 1280 px to 3840 px wide, the page shows all its content with no horizontal scroll and no overlapping elements. |

## Feature: Session list

| ID | Requirement |
|----|-------------|
| REQ-11 | Each list entry shows the label, the project folder, the state and the time of the last activity, each always in the same place in the entry. |
| REQ-12 | Each state in the list shows a colour, an icon and a text together. |
| REQ-13 | A "needs input" entry stands out more than any other entry of the list, the open one included. |
| REQ-14 | The needs-input counter stays visible whatever the main area shows. |
| REQ-15 | An external entry carries a visible mark that hosted entries do not have, and the mark does not rely on colour alone. |
| REQ-16 | The entry of the open session is highlighted, and no other entry has that highlight. |

## Feature: Open session

| ID | Requirement |
|----|-------------|
| REQ-17 | A header above the open session shows its project folder, label and state, and the actions available for it. |
| REQ-18 | The terminal of a hosted session fills the whole main area below the header. |
| REQ-19 | The view of an external session shows a read-only notice that stays visible while the user scrolls. |
| REQ-20 | In the external view, user messages, Claude messages and tool calls each have their own look. |
| REQ-21 | In the external view, each tool call and each tool output longer than 5 lines is shown collapsed, and the user can expand it to its full content and collapse it again. |
| REQ-22 | The external view follows new content while the user is at the end of the conversation. |
| REQ-23 | While the user reads earlier content in the external view, new content does not move the view. |
| REQ-24 | With 10 active sessions, opening a session or switching to another one shows its content within one second. |

## Feature: Dialogs

The folder chooser, the resume history, the running-elsewhere warning and the stop confirmation.

| ID | Requirement |
|----|-------------|
| REQ-25 | Each dialog has one primary action, which looks different from its other actions, and a cancel action. |
| REQ-26 | In a dialog, Enter triggers the primary action, unless the focus is on another button. |
| REQ-27 | In a dialog, Esc closes the dialog with no effect. |
| REQ-28 | The running-elsewhere warning and the stop confirmation look different from the other dialogs. |

## Feature: Feedback states

| ID | Requirement |
|----|-------------|
| REQ-29 | The session list, the open session, the folder chooser and the resume history show a loading state while their data loads. |
| REQ-30 | Each failure shows a message in Italian that says in plain words what failed. |
| REQ-31 | While a start, stop or resume runs, the client shows that it is in progress. |
| REQ-32 | When a start, stop or resume ends, the client shows whether it succeeded or failed. |

## Constraints on every batch

These are not REQs: no single batch can close them, so every batch must keep them true.

- No behaviour change → every requirement of `plan-claude_sessions_client` stays true. Its tests keep checking each of them, updated where the redesign changes a label or a UI step. This covers the terminal features of hosted sessions: slash commands, interrupt, permission answers.
- The client does not reformat the content of a hosted session's terminal. The terminal may keep its own colours in the light theme.
- UI text stays in Italian. Labels may be reworded for clarity.
