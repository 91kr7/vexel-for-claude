import { XIcon } from '../icons/Icons';
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
