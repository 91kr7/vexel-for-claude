# Module history

| Component | Type | Path | Responsibility | Spec |
|-----------|------|------|----------------|------|
| SessionHistory | backend service | `src/server/history/session-history.ts` | Reads the past Claude Code sessions under `<claudeDir>/projects`, read-only | `specs/session-history.md` |
| ExternalSessionCheck | backend service | `src/server/history/external-session-check.ts` | Ids and data of the sessions that run in a live process the client does not host | `specs/external-session-check.md` |
| PastSessionListRoute | REST endpoint | `src/server/history/past-session-list-route.ts` | `GET /api/past-sessions`: past sessions grouped by folder, most recent first | `specs/past-session-list-route.md` |
| ResumeSessionRoute | REST endpoint | `src/server/history/resume-session-route.ts` | `POST /api/past-sessions/:id/resume`: resumes a past session in the client | `specs/resume-session-route.md` |
| ResumeDialog | UI component | `src/web/history/ResumeDialog.tsx` | Dialog with one radio row per past session, grouped under mono folder paths, to resume it with "Riprendi" | `specs/resume-dialog.md` |
| RunningElsewhereWarning | UI component | `src/web/history/RunningElsewhereWarning.tsx` | Amber warning dialog, with the text in the amber banner, before resuming a session that runs in another terminal | `specs/running-elsewhere-warning.md` |
