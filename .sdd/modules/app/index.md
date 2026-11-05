# Module app

| Component | Type | Path | Responsibility | Spec |
|-----------|------|------|----------------|------|
| Server | configuration | `src/server/main.ts` | Fastify process on 127.0.0.1: guard, routes, static page | `specs/server.md` |
| LocalAccessGuard | backend service (request hook) | `src/server/local-access-guard.ts` | Rejects HTTP and WebSocket requests whose Host or Origin is not local | `specs/local-access-guard.md` |
| AppLayout | UI page | `src/web/AppLayout.tsx` | Sidebar with title, counter, "Nuova sessione", "Riprendi sessione" and session list, next to the main area (open session or empty state) | `specs/app-layout.md` |
| EmptyState | UI component | `src/web/EmptyState.tsx` | Main area with no open session: icon, short text, "Nuova sessione" and "Riprendi sessione" | `specs/empty-state.md` |
| WebEntry | UI entry point | `src/web/index.html`, `src/web/main.tsx`, `src/web/styles.css` | Italian page that mounts AppLayout with the global styles, in the system theme | `specs/web-entry.md` |
| ThemeTokens | configuration | `src/web/theme/tokens.css` | CSS custom properties for colours, type, spacing, radii, icons and focus ring, light and dark | `specs/theme-tokens.md` |
| BundledFont | configuration | `src/web/fonts/inter.css`, `src/web/fonts/inter-latin-wght-normal.woff2`, `src/web/fonts/OFL.txt` | Inter font shipped with the client, with its licence | `specs/bundled-font.md` |
| Dialog | UI component | `src/web/dialogs/Dialog.tsx` | Shared modal frame: title, content, primary action and "Annulla", Enter, Esc, focus trap | `specs/dialog.md` |
| WarningDialog | UI component | `src/web/dialogs/WarningDialog.tsx` | Dialog for a risky action: warning look, danger primary, focus on "Annulla" | `specs/warning-dialog.md` |
| ProgressIndicator | UI component | `src/web/feedback/ProgressIndicator.tsx` | Rotating indicator with an Italian label for a loading area, and the Spinner of a busy button | `specs/progress-indicator.md` |
| ErrorMessage | UI component | `src/web/feedback/ErrorMessage.tsx` | Icon and Italian text in the error colour, announced as an alert | `specs/error-message.md` |
| IconSet | UI component | `src/web/icons/Icons.tsx`, `src/web/icons/LICENSE` | Lucide icons as local decorative SVG components, with their licence | `specs/icon-set.md` |
| ThirdPartyNotices | document | `THIRD-PARTY-NOTICES.md` | Source, version and licence of each third-party font and icon set | `specs/third-party-notices.md` |
