# Module folders

| Component | Type | Path | Responsibility | Spec |
|-----------|------|------|----------------|------|
| FolderRoute | REST endpoint | `src/server/folders/folder-route.ts` | `GET /api/folders`: subfolders of an absolute path, home by default | `specs/folder-route.md` |
| FolderChooser | UI component | `src/web/folders/FolderChooser.tsx` | New-session dialog: mono path field, "Recent" folders of past sessions, folder browser, start | `specs/folder-chooser.md` |
| ProjectListStore | frontend service | `src/web/folders/project-list-store.ts` | Loads the project folders from `GET /api/past-sessions` on demand, keeps the last loaded list, leaves out removed projects and puts the favorite projects first | `specs/project-list-store.md` |
| ProjectList | UI component | `src/web/folders/ProjectList.tsx` | "Projects" view of the list panel: a search bar that filters the rows by folder path, one row per project folder with name and favorite star, path, last activity, "Folder not found", and the remove button, plus loading, empty and error states; an available row is chosen with click, Enter or Space | `specs/project-list.md` |
| SessionNameDialog | UI component | `src/web/folders/SessionNameDialog.tsx` | Name dialog "New session": the chosen project, the "Session name" field, and "Start Session" that starts the session in its folder | `specs/session-name-dialog.md` |
| ProjectMarkStore | backend service | `src/server/folders/project-mark-store.ts` | Project favorite mark and removal time by folder, saved in a JSON file of the client data folder, with change listeners | `specs/project-mark-store.md` |
| ProjectFavoriteRoute | REST endpoint | `src/server/folders/project-favorite-route.ts` | `PUT /api/projects/favorite`: sets or clears the project favorite mark of an absolute folder path | `specs/project-favorite-route.md` |
| ProjectMarkEventsRoute | REST endpoint (WebSocket) | `src/server/folders/project-mark-events-route.ts` | `GET /api/projects/marks`: the project marks and removals on connect and after each change | `specs/project-mark-events-route.md` |
| ProjectMarkLiveStore | frontend service | `src/web/folders/project-mark-live-store.ts` | Project marks of the page, kept current by the events route, reconnected every 2 s after a loss | `specs/project-mark-live-store.md` |
| ProjectFavoriteButton | UI component | `src/web/folders/ProjectFavoriteButton.tsx` | Bare star after the project name: "Mark as Favorite" or "Remove Favorite", "pop" on marking, with its error under the row | `specs/project-favorite-button.md` |
| ProjectRemoveRoute | REST endpoint | `src/server/folders/project-remove-route.ts` | `POST /api/projects/remove`: records the removal of an absolute folder path from the Projects list | `specs/project-remove-route.md` |
| ProjectRemoveButton | UI component | `src/web/folders/ProjectRemoveButton.tsx` | 22 px round X at the right end of a project row: "Remove from Projects", with its error under the row | `specs/project-remove-button.md` |
