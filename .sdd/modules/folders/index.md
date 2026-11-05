# Module folders

| Component | Type | Path | Responsibility | Spec |
|-----------|------|------|----------------|------|
| FolderRoute | REST endpoint | `src/server/folders/folder-route.ts` | `GET /api/folders`: subfolders of an absolute path, home by default | `specs/folder-route.md` |
| FolderChooser | UI component | `src/web/folders/FolderChooser.tsx` | Modal to browse or type a folder and start a session in it | `specs/folder-chooser.md` |
