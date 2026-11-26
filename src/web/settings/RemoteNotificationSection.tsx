import { useEffect, useId, useState } from 'react';
import { type RemoteSettings, readRemoteSettings, saveRemoteSettings } from '../desktop-bridge';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { checkTopicUrl } from './topic-url-check';

function locked(settings: RemoteSettings): RemoteSettings {
  return checkTopicUrl(settings.topicUrl).status === 'valid' ? settings : { ...settings, enabled: false };
}

export function RemoteNotificationSection() {
  const [settings, setSettings] = useState<RemoteSettings | null>(null);
  const reasonId = useId();

  useEffect(() => {
    let active = true;
    void readRemoteSettings().then((read) => {
      if (!active) return;
      const shown = locked(read);
      setSettings(shown);
      if (shown.enabled !== read.enabled) void saveRemoteSettings(shown);
    });
    return () => {
      active = false;
    };
  }, []);

  const current = settings ?? { enabled: false, topicUrl: '', token: '' };
  const check = checkTopicUrl(current.topicUrl);
  const loading = settings === null;

  const change = (patch: Partial<RemoteSettings>) => {
    if (!settings) return;
    const next = locked({ ...settings, ...patch });
    setSettings(next);
    void saveRemoteSettings(next);
  };

  return (
    <section className="sound-card remote-card">
      <button
        type="button"
        role="switch"
        aria-checked={current.enabled}
        className="sound-switch"
        disabled={loading || check.status !== 'valid'}
        onClick={() => change({ enabled: !current.enabled })}
      >
        <span className="sound-switch-label">Send a remote notification after 60 seconds of waiting</span>
        <span className="sound-switch-track" aria-hidden="true">
          <span className="sound-switch-knob" />
        </span>
      </button>
      <div className="remote-fields">
        <label className="field">
          <span className="field-label">Topic URL</span>
          <input
            className="field-input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://ntfy.sh/your-topic"
            value={current.topicUrl}
            disabled={loading}
            aria-invalid={check.status === 'invalid' ? true : undefined}
            aria-describedby={check.status === 'invalid' ? reasonId : undefined}
            onChange={(event) => change({ topicUrl: event.target.value })}
          />
        </label>
        {check.status === 'invalid' && (
          <div id={reasonId}>
            <ErrorMessage>{check.reason}</ErrorMessage>
          </div>
        )}
        <label className="field">
          <span className="field-label">Access token (optional)</span>
          <input
            className="field-input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={current.token}
            disabled={loading}
            onChange={(event) => change({ token: event.target.value })}
          />
        </label>
      </div>
    </section>
  );
}
