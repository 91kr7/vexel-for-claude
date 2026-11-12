import { AreaState } from '../feedback/AreaState';
import { FolderIcon } from '../icons/Icons';
import { Avatar, folderNameOf } from '../sessions/Avatar';
import { RelativeTime } from '../sessions/RelativeTime';
import { type Project, type ProjectListStore, useProjectList } from './project-list-store';

type ChooseProject = (project: Project) => void;

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
        <span className="project-row-name">{folderNameOf(project.folder)}</span>
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
  return (
    <>
      <div className="list-panel-title">
        <h1 className="section-label">Projects</h1>
      </div>
      <div className="project-list">
        {state.kind === 'loading' ? (
          <AreaState kind="loading" size="compact" title="Loading…" />
        ) : state.kind === 'error' ? (
          <AreaState kind="error" size="compact" title="Could not load the projects." />
        ) : state.projects.length === 0 ? (
          <AreaState kind="empty" size="compact" title="No projects yet" icon={<FolderIcon />} />
        ) : (
          <ul>
            {state.projects.map((project) => (
              <li key={project.folder}>
                <ProjectRow project={project} onChoose={onChoose} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
