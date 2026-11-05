# Module folders

| Component | Type | Path | Responsibility | Spec |
|-----------|------|------|----------------|------|
| FolderRoute | REST endpoint | `src/server/folders/folder-route.ts` | `GET /api/folders`: subfolders of an absolute path, home by default | `specs/folder-route.md` |
| FolderChooser | UI component | `src/web/folders/FolderChooser.tsx` | New-session dialog: mono path field, "Recenti" folders of past sessions, folder browser, start | `specs/folder-chooser.md` |
