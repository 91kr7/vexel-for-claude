# Module app

| Component | Type | Path | Responsibility | Spec |
|-----------|------|------|----------------|------|
| Server | configuration | `src/server/main.ts` | Fastify process on 127.0.0.1: guard, routes, static page | `specs/server.md` |
| LocalAccessGuard | backend service (request hook) | `src/server/local-access-guard.ts` | Rejects HTTP and WebSocket requests whose Host or Origin is not local | `specs/local-access-guard.md` |
| AppLayout | UI page | `src/web/AppLayout.tsx` | Header with counter, "Riprendi sessione" and "Nuova sessione", session list and open-session area (terminal or read-only conversation) | `specs/app-layout.md` |
| WebEntry | UI entry point | `src/web/index.html`, `src/web/main.tsx`, `src/web/styles.css` | Italian page that mounts AppLayout with the global styles | `specs/web-entry.md` |
