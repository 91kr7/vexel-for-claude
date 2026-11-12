import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AreaState } from '../feedback/AreaState';
import { FolderIcon, SearchIcon, XIcon } from '../icons/Icons';
import { Avatar, folderNameOf } from '../sessions/Avatar';
import { FavoriteIndicator } from '../sessions/FavoriteIndicator';
import { RelativeTime } from '../sessions/RelativeTime';
import { ProjectFavoriteButton } from './ProjectFavoriteButton';
import { ProjectRemoveButton } from './ProjectRemoveButton';
import { type Project, type ProjectListStore, useProjectList } from './project-list-store';

type ChooseProject = (project: Project) => void;

function nearestShownFolder(previous: Project[], left: string, shown: Project[]): string | undefined {
  const index = previous.findIndex((project) => project.folder === left);
  if (index < 0) return undefined;
  const shownFolders = new Set(shown.map((project) => project.folder));
  const isShown = (project: Project) => shownFolders.has(project.folder);
  return (previous.slice(index + 1).find(isShown) ?? previous.slice(0, index).reverse().find(isShown))?.folder;
}

function ProjectRow({ project, onChoose }: { project: Project; onChoose?: ChooseProject | undefined }) {
  return (
    <button
      type="button"
      className={project.available ? 'project-row' : 'project-row unavailable'}
      aria-disabled={project.available ? undefined : true}
      onClick={() => {
        if (project.available) onChoose?.(project);
      }}
    >
      <Avatar folder={project.folder} />
      <span className="project-row-text">
        <span className="project-row-heading">
          <span className="project-row-name">{folderNameOf(project.folder)}</span>
          {project.favorite && <FavoriteIndicator />}
        </span>
        <span className="project-row-path" title={project.folder}>
          {project.folder}
        </span>
        <span className="project-row-meta">
          {!project.available && (
            <>
              <span className="project-row-missing">Folder not found</span>
              {' · '}
            </>
          )}
          Last activity <RelativeTime iso={project.lastActivity} />
        </span>
      </span>
      {project.available && (
        <span className="project-row-go" aria-hidden="true">
          ▶ New session
        </span>
      )}
    </button>
  );
}

export function ProjectList({ store, onChoose }: { store?: ProjectListStore; onChoose?: ChooseProject }) {
  const state = useProjectList(store);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const allProjects = state.kind === 'ready' ? state.projects : undefined;
  const projects = useMemo(() => {
    const text = query.toLowerCase();
    return text === '' ? allProjects : allProjects?.filter((project) => project.folder.toLowerCase().includes(text));
  }, [allProjects, query]);
  const listRef = useRef<HTMLUListElement>(null);
  const focusedFolder = useRef<string | undefined>(undefined);
  const shownProjects = useRef(projects);

  useLayoutEffect(() => {
    const previous = shownProjects.current;
    shownProjects.current = projects;
    const left = focusedFolder.current;
    if (left === undefined || previous === undefined || projects === undefined) return;
    if (projects.some((project) => project.folder === left)) return;
    focusedFolder.current = undefined;
    if (document.activeElement !== null && document.activeElement !== document.body) return;
    const target = nearestShownFolder(previous, left, projects);
    const targetIndex = projects.findIndex((project) => project.folder === target);
    listRef.current?.children[targetIndex]?.querySelector<HTMLElement>('.project-row')?.focus();
  }, [projects]);

  return (
    <>
      <div className="list-panel-title">
        <h1 className="section-label">Projects</h1>
      </div>
      {allProjects !== undefined && allProjects.length > 0 && (
        <div className="search-field">
          <SearchIcon />
          <input
            ref={searchRef}
            className="field-input search-field-input project-search-input"
            type="text"
            value={query}
            placeholder="Search projects"
            aria-label="Search projects"
            onChange={(event) => setQuery(event.target.value)}
          />
          {query !== '' && (
            <button
              type="button"
              className="search-field-clear"
              aria-label="Clear Search"
              title="Clear Search"
              onClick={() => {
                setQuery('');
                searchRef.current?.focus();
              }}
            >
              <XIcon />
            </button>
          )}
        </div>
      )}
      <div className="project-list">
        {state.kind === 'loading' ? (
          <AreaState kind="loading" size="compact" title="Loading…" />
        ) : state.kind === 'error' ? (
          <AreaState kind="error" size="compact" title="Could not load the projects." />
        ) : state.projects.length === 0 ? (
          <AreaState kind="empty" size="compact" title="No projects yet" icon={<FolderIcon />} />
        ) : projects === undefined || projects.length === 0 ? (
          <AreaState kind="empty" size="compact" title={`No projects match "${query}"`} icon={<FolderIcon />} />
        ) : (
          <ul
            ref={listRef}
            onBlur={(event) => {
              if (event.relatedTarget !== null && !event.currentTarget.contains(event.relatedTarget)) focusedFolder.current = undefined;
            }}
          >
            {projects.map((project) => (
              <li key={project.folder} onFocus={() => (focusedFolder.current = project.folder)}>
                <ProjectRow project={project} onChoose={onChoose} />
                <ProjectFavoriteButton folder={project.folder} favorite={project.favorite} />
                <ProjectRemoveButton folder={project.folder} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
