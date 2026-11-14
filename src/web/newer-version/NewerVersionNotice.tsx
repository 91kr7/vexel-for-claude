import { XIcon } from '../icons/Icons';
import { ChangelogText } from './ChangelogText';
import type { NewerVersion } from './newer-version-loader';

interface NewerVersionNoticeProps {
  version: NewerVersion;
  onClose: () => void;
}

export function NewerVersionNotice({ version, onClose }: NewerVersionNoticeProps) {
  return (
    <section className="update-notice vx-glass" role="status" aria-label="Update Available">
      <div className="update-notice-content">
        <h2 className="update-notice-title">Update Available</h2>
        <p className="update-notice-text">
          Version {version.newerVersion} is available.{' '}
          <br />
          You have {version.installedVersion}.
        </p>
        {version.changelogs && version.changelogs.length > 0 && (
          <div className="update-notice-changelogs">
            {version.changelogs.map((changelog) => (
              <section key={changelog.version} className="update-notice-release" aria-label={`Version ${changelog.version}`}>
                <h3 className="update-notice-release-title">Version {changelog.version}</h3>
                {changelog.text !== undefined && <ChangelogText text={changelog.text} />}
              </section>
            ))}
          </div>
        )}
        <a className="update-notice-link" href={version.releaseUrl} target="_blank" rel="noopener noreferrer">
          View Release
        </a>
      </div>
      <button type="button" className="update-notice-close" aria-label="Close Update Notice" onClick={onClose}>
        <XIcon />
      </button>
    </section>
  );
}
