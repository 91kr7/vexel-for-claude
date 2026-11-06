---
batch: remembered-theme
feature: Remembered theme
closed_req: REQ-17, REQ-18, REQ-19, REQ-20
depends: light-theme
---

# Batch — Remembered theme

The client saves the theme the user picks and shows it from the first frame of the next start. With nothing saved, the client starts light. The desktop app's startup page is always light. The REQ ids refer to `plan-light_theme/requirements.md`.

## Decisions for this batch

- **Light by default** (REQ-19) and **startup page always light** (REQ-20) are human decisions of 2026-11-06.
- **Where the choice is saved.** In the page's `localStorage`, like the session order (SessionOrderStore). Each browser and the desktop window keep their own choice. The backend stores nothing.
- **Desktop restarts.** Electron keeps the `localStorage` of the page origin (`http://127.0.0.1:4001`) in its profile folder between launches. So no change to the desktop app is planned for REQ-17. A value other than "light" or "dark" counts as no choice.
- **First frame.** A small inline script in the head of the page sets the theme mark before the first paint. The server sends no Content-Security-Policy for the page (Server spec), so an inline script runs. The theme store then starts from that mark.
- **Startup page values.** The startup page cannot import `src/web`. It copies the light values of ThemeTokens: canvas, primary text, the light error tone and the light accent tone (batch `light-theme`, INT-1 to INT-4).
- **Tests.** The desktop checks (REQ-17 across a desktop restart, REQ-20) go in the Electron e2e group, `npm run test:e2e:desktop`. The default e2e run stays browser only (knowledge base `electron-e2e-separate`).

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/index.html` | Inline script in the head, before the styles: read the saved choice and set the theme mark on the page root. With no valid choice, set light. | REQ-18, REQ-19 | — |
| INT-2 | modify | theme store from batch `light-theme` (path in `.sdd/modules/app/index.md`) | Start from the mark set by INT-1. Save the new theme in `localStorage` on each toggle. | REQ-17 | INT-1 |
| INT-3 | modify | `src/desktop/startup-page.ts` | Loading and error states use the light colours set in "Decisions", whatever the saved choice. | REQ-20 | — |

The developer updates the specs and the indexes: WebEntry, the theme store and StartupPage (its "dark Studio" colours rule).

## Human acceptance

### Scenario: The client opens light the first time

- REQ → REQ-18, REQ-19
- Given → a browser that has never opened the client
- When → the user opens the client
- Then → the client shows the light theme from the first frame, with no dark flash

### Scenario: The client keeps the dark theme the user chose

- REQ → REQ-17, REQ-18
- Given → the user switched the client to dark
- When → the user reloads the page, then closes the browser and opens the client again
- Then → each time the client shows the dark theme from the first frame, with no light flash

### Scenario: The desktop app keeps its own choice, with a light startup page

- REQ → REQ-17, REQ-20
- Given → the desktop app runs with the dark theme chosen, and the browser client is light
- When → the user quits the desktop app and opens "Vexel for Claude" again
- Then → the window shows the light "Starting the backend…" page, then the client in the dark theme
- And → the browser client is still light
