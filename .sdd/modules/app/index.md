# Module app

| Component | Type | Path | Responsibility | Spec |
|-----------|------|------|----------------|------|
| Server | configuration | `src/server/main.ts` | Fastify process on 127.0.0.1: guard, routes, static page | `specs/server.md` |
| LocalAccessGuard | backend service (request hook) | `src/server/local-access-guard.ts` | Rejects HTTP and WebSocket requests whose Host or Origin is not local | `specs/local-access-guard.md` |
| AppLayout | UI page | `src/web/AppLayout.tsx` | Full-window frame: top bar, rail, 224 px list panel ("Sessions", needs-input chip, session list), dot-grid main area, fixed snackbar | `specs/app-layout.md` |
| TopBar | UI component | `src/web/TopBar.tsx` | 48 px bar with the "VX" logo mark, "Vexel for Claude", the theme switch and "New Session" | `specs/top-bar.md` |
| EmptyState | UI component | `src/web/EmptyState.tsx` | Main area with no open session: full AreaState with "New Session" and "Resume Session" | `specs/empty-state.md` |
| NavigationRail | UI component | `src/web/NavigationRail.tsx` | 52 px rail: "New Claude Code Session", "Sessions" with the amber badge, "Resume", hover tooltips | `specs/navigation-rail.md` |
| NeedsInputSnackbar | UI component | `src/web/NeedsInputSnackbar.tsx` | Glass toast "<project> needs your input" with "Open", and the rule that picks its session | `specs/needs-input-snackbar.md` |
| WebEntry | UI entry point | `src/web/index.html`, `src/web/main.tsx`, `src/web/styles.css` | English page that marks the saved theme (light by default) before the first paint and mounts AppLayout, with `color-scheme` following the theme, with the global styles, the mock classes and the button, label and field classes | `specs/web-entry.md` |
| ThemeTokens | configuration | `src/web/theme/tokens.css` | The mock's dark and editorial-light tokens with the light-blue accent, status colours, fixed terminal colours, shadows and focus ring | `specs/theme-tokens.md` |
| ThemeStore | frontend service | `src/web/theme/theme-store.ts` | Active theme of the page, started from the page mark, its `data-theme` mark on the root, and the toggle that saves it in `localStorage` | `specs/theme-store.md` |
| ThemeSwitch | UI component | `src/web/ThemeSwitch.tsx` | Top-bar sun/moon icon button "Dark theme" that toggles the theme | `specs/theme-switch.md` |
| BundledFont | configuration | `src/web/fonts/roboto.css`, `src/web/fonts/roboto-flex-latin.woff2`, `src/web/fonts/roboto-mono-latin.woff2`, `src/web/fonts/OFL.txt` | Roboto Flex and Roboto Mono fonts shipped with the client, with their licence | `specs/bundled-font.md` |
| Dialog | UI component | `src/web/dialogs/Dialog.tsx` | Shared modal frame of the mock: header with "[Esc]", body, footer with "Cancel" and primary action, Enter, Esc, focus trap | `specs/dialog.md` |
| WarningDialog | UI component | `src/web/dialogs/WarningDialog.tsx` | Dialog for a risky action: rose or amber primary action, amber banner, focus on "Cancel" | `specs/warning-dialog.md` |
| AreaState | UI component | `src/web/feedback/AreaState.tsx` | Empty, loading or error block that fills an area, in full or compact size | `specs/area-state.md` |
| ProgressIndicator | UI component | `src/web/feedback/ProgressIndicator.tsx` | Rotating indicator with a label for a loading area, and the Spinner of a busy button | `specs/progress-indicator.md` |
| ErrorMessage | UI component | `src/web/feedback/ErrorMessage.tsx` | Icon and text in rose, announced as an alert | `specs/error-message.md` |
| IconSet | UI component | `src/web/icons/Icons.tsx`, `src/web/icons/LICENSE` | Lucide icons as local decorative SVG components, with their licence | `specs/icon-set.md` |
| ThirdPartyNotices | document | `THIRD-PARTY-NOTICES.md` | Source, version and licence of each third-party font and icon set | `specs/third-party-notices.md` |
