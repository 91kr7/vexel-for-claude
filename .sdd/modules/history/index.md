# Module history

| Component | Type | Path | Responsibility | Spec |
|-----------|------|------|----------------|------|
| SessionHistory | backend service | `src/server/history/session-history.ts` | Reads the past Claude Code sessions under `<claudeDir>/projects`, read-only | `specs/session-history.md` |
| ExternalSessionCheck | backend service | `src/server/history/external-session-check.ts` | Ids and data of the sessions that run in a live process the client does not host | `specs/external-session-check.md` |
| PastSessionListRoute | REST endpoint | `src/server/history/past-session-list-route.ts` | `GET /api/past-sessions`: past sessions grouped by folder, most recent first | `specs/past-session-list-route.md` |
| ResumeSessionRoute | REST endpoint | `src/server/history/resume-session-route.ts` | `POST /api/past-sessions/:id/resume`: resumes a past session in the client | `specs/resume-session-route.md` |
| ResumeDialog | UI component | `src/web/history/ResumeDialog.tsx` | Modal to choose a past session by folder and resume it | `specs/resume-dialog.md` |
| RunningElsewhereWarning | UI component | `src/web/history/RunningElsewhereWarning.tsx` | Warning modal before resuming a session that runs in another terminal | `specs/running-elsewhere-warning.md` |
