---
request_slug: claude_sessions_client-ui_redesign
date: 2026-11-05
type: evolution
size: ordinary
reference: .sdd/analysis/claude_sessions_client.md
---

# Analysis — UI/UX redesign of the Claude sessions client

## Request

> refactor completo della UI/UX del client delle sessioni Claude: al momento è inguardabile! se vuoi puoi scaricare da internet materiale per creare un design moderno e funzionale

## Reference

[claude_sessions_client.md](claude_sessions_client.md) → a local web client that lists the user's Claude Code sessions with their state. The user opens, starts, stops and resumes sessions from it. A hosted session shows Claude Code's own terminal. An external session shows its conversation read-only, with "Riprendi qui". That analysis sets no visual or UX requirement.

Changes:
- New goal: a modern, consistent and readable look for every screen, and a clearer interaction with the existing features.
- No behaviour changes. Every requirement of the reference analysis stays true.

## Summary

Redesign the look and the interaction of every screen and dialog of the client. The features stay the same.

## Business goal

The client exists so the user stops juggling many shells. The human finds the current UI "inguardabile". A client that is unpleasant or hard to read at a glance pushes the user back to the shells. Then the main value is lost: seeing at once which session needs attention.

## Requirements

### Functional

General
- Every screen must use one visual language: the same colours, type, spacing, icons and component styles.
- The client must offer a light and a dark theme, and must follow the operating system setting.
- The session list and the open session must be visible side by side.
- When no session is open, the main area must show an empty state with the actions to start or resume a session.
- Every area that loads data must show a loading state.
- Every failure must show a readable error message in Italian.
- Start, stop and resume must show visible feedback while they run and when they end.

Session list
- Each entry must show label, project folder, state and time of last activity, readable at a glance.
- Each state must be shown with colour, icon and text together, never with colour alone.
- "Needs input" entries must be the most visible elements of the list.
- The needs-input counter must stay visible on every screen.
- External sessions must be distinguishable from hosted ones at a glance.
- The open session must be clearly highlighted in the list.

Open session
- A header must show the project folder, label and state of the open session, and the actions available for it.
- The terminal of a hosted session must use most of the main area.
- The view of an external session must say clearly that it is read-only.
- In the external view, user messages, Claude messages and tool calls must look different from each other.
- In the external view, tool calls and long outputs must be compact, and the user must be able to expand them.
- The external view must follow new content live, but must not move while the user reads earlier content.

Dialogs (folder chooser, resume history, running-elsewhere warning, stop confirmation)
- Each dialog must have one clear primary action and a way to cancel.
- Enter must trigger the primary action and Esc must close the dialog with no effect.
- Warnings and confirmations of risky actions must look different from ordinary dialogs.

### Non-functional

- Text and state indicators must meet WCAG 2.2 AA contrast in both themes.
- Every existing action must be reachable with the keyboard, with a visible focus.
- The layout must work from a 1280 px wide screen up to wide monitors.
- Opening or switching a session must still take about one second at most, with 10 active sessions.

## Assumptions

- This is an evolution, not a fix. The gatekeeper decided it: the reference sets no visual requirement, so it was not wrong.
- The human gave no visual reference. The later phases choose the style within the requirements above.
- The content of a hosted session's terminal belongs to Claude Code. The client does not reformat it and redesigns only what it draws around it.
- The terminal area may keep its own colours in the light theme. Claude Code's output colours are made for a terminal.
- UI text stays in Italian, as in the reference. Labels may be reworded for clarity.

## Constraints

- Material downloaded from the internet (fonts, icons, images) must have a licence that allows its use in this project.
- The client must ship that material itself. It is a local-only tool and must not contact outside servers to draw its pages.
- The redesign must not remove any terminal feature of hosted sessions: slash commands, interrupt, permission answers.

## Market trends

Tools for parallel Claude Code sessions in 2026 share a few UI patterns. The sources are third-party articles, not Anthropic documentation.

- Claude Code desktop app, redesigned in April 2026: a session sidebar next to the open session, filters and grouping by project, a shortcut to cycle sessions, transcript modes from verbose to summary ([Miraflow](https://miraflow.ai/blog/claude-code-desktop-redesign-parallel-sessions-routines-workspace-guide)).
- Claude Code Agent View, CLI, May 2026: one row per session with name, coloured state icon, a one-line summary of the last action and the time since the last state change. Sessions that need input rise to the top ([pasqualepillitteri.it](https://pasqualepillitteri.it/en/news/2384/claude-code-agent-view-cli-dashboard-sessions-2026)).
- Community tools such as Chorus: a colour-coded state per session, unread markers and notifications ([awesome.ecosyste.ms](https://awesome.ecosyste.ms/projects/github.com%2Fa179346%2Fchorus), search result only).
- UX pattern catalogues ask for tool calls the user can inspect and for explicit approval steps ([AI UX Playground](https://aiuxplayground.com/patterns/agents), [blakecrosley.com](https://blakecrosley.com/blog/agent-interface-is-the-harness)).

What this means for the request:
- A sidebar next to the main area and states shown by colour plus icon are the common standard. Following it costs the user no learning.
- The client already has the core: states and needs-input first. The redesign makes them visible, it does not add them.
- Filters, grouping, shortcuts, summaries and transcript modes exist elsewhere, but the human left them out (see Scope).

## Risks

- A redesign can break existing behaviour, for example live list updates, needs-input ordering or "Riprendi qui". Every behaviour of the reference must be checked again.
- A softer style can make "needs input" less visible. That loses the main value of the client.
- A light theme around a dark terminal can look inconsistent.
- Downloaded material with an unclear licence creates a legal risk.

## Scope

In scope:
- Visual design and interaction of every screen and dialog, in light and dark theme.
- Keyboard use of the existing actions: Enter/Esc in dialogs, visible focus.
- Empty, loading, error and progress states.
- Rewording of Italian UI labels for clarity.

Out of scope, by human decision:
- Search, filters and grouping of the session list.
- Keyboard shortcuts to switch between sessions.

Out of scope:
- Any new feature, or any change to the behaviour of the reference.
- Reformatting the content of a hosted session's terminal.
- Transcript view modes, last-action summaries, notifications.
- A theme switch inside the client: the theme follows the operating system only.
- Phone and small-screen layouts.
