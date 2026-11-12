# Module folders

| Component | Type | Path | Responsibility | Spec |
|-----------|------|------|----------------|------|
| FolderRoute | REST endpoint | `src/server/folders/folder-route.ts` | `GET /api/folders`: subfolders of an absolute path, home by default | `specs/folder-route.md` |
| FolderChooser | UI component | `src/web/folders/FolderChooser.tsx` | New-session dialog: mono path field, "Recent" folders of past sessions, folder browser, start | `specs/folder-chooser.md` |
| ProjectListStore | frontend service | `src/web/folders/project-list-store.ts` | Loads the project folders from `GET /api/past-sessions` on demand and keeps the last loaded list | `specs/project-list-store.md` |
| ProjectList | UI component | `src/web/folders/ProjectList.tsx` | "Projects" view of the list panel: one row per project folder with path, last activity and "Folder not found", plus loading, empty and error states; an available row is chosen with click, Enter or Space | `specs/project-list.md` |
| SessionNameDialog | UI component | `src/web/folders/SessionNameDialog.tsx` | Name dialog "New session": the chosen project, the "Session name" field, and "Start Session" that starts the session in its folder | `specs/session-name-dialog.md` |
