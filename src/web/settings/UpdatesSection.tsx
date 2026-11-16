import { useEffect, useId, useRef, useState } from 'react';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { useInstalledVersion } from '../installed-version-loader';
import type { NewerVersion } from '../newer-version/newer-version-loader';
import { checkForUpdates, type UpdateCheckResult } from '../newer-version/update-check-client';

interface UpdatesSectionProps {
  onNewerVersion: (version: NewerVersion) => void;
  check?: (signal?: AbortSignal) => Promise<UpdateCheckResult>;
}

function CheckResult({ result }: { result: UpdateCheckResult }) {
  if (result.status === 'failed') return <ErrorMessage>Could not check for updates. Try again later.</ErrorMessage>;
  if (result.status === 'current') {
    return (
      <p className="updates-result" role="status">
        You are up to date (v{result.installedVersion})
      </p>
    );
  }
  const { version } = result;
  return (
    <div className="updates-result" role="status">
      <p>
        Version {version.newerVersion} is available. You have {version.installedVersion}.
      </p>
      <a className="update-notice-link" href={version.releaseUrl} target="_blank" rel="noopener noreferrer">
        View Release
      </a>
    </div>
  );
}

export function UpdatesSection({ onNewerVersion, check = checkForUpdates }: UpdatesSectionProps) {
  const installedVersion = useInstalledVersion();
  const labelId = useId();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const runCheck = () => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setChecking(true);
    setResult(null);
    void check(controller.signal).then((checked) => {
      if (controller.signal.aborted) return;
      setChecking(false);
      setResult(checked);
      if (checked.status === 'newer') onNewerVersion(checked.version);
    });
  };

  return (
    <section className="updates-section" aria-labelledby={labelId}>
      <h3 id={labelId} className="section-label">
        Updates
      </h3>
      {installedVersion !== null && <p className="updates-installed">Installed version: v{installedVersion}</p>}
      <button type="button" className="button-neutral updates-check" disabled={checking} onClick={runCheck}>
        {checking ? 'Checking…' : 'Check for Updates'}
      </button>
      {result && <CheckResult result={result} />}
    </section>
  );
}
