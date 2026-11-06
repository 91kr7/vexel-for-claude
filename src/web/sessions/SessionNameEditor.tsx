import { useEffect, useRef, useState } from 'react';
import { ErrorMessage } from '../feedback/ErrorMessage';

export const NAME_MAX_LENGTH = 200;
const RENAME_FAILED = 'Could not rename the session.';

export type NameEditorEnd = 'saved' | 'cancelled' | 'blurred';

interface SessionNameEditorProps {
  sessionId: string;
  label: string;
  onEnd: (end: NameEditorEnd) => void;
}

export function SessionNameEditor({ sessionId, label, onEnd }: SessionNameEditorProps) {
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(label);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  const save = async () => {
    if (busy) return;
    if (value === label) {
      onEnd('saved');
      return;
    }
    setBusy(true);
    setError(false);
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/name`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: value }),
      });
      if (response.ok) {
        onEnd('saved');
        return;
      }
      setError(true);
    } catch {
      setError(true);
    }
    setBusy(false);
  };

  return (
    <div className="session-name-editor">
      <input
        ref={input}
        className="session-name-input"
        type="text"
        aria-label="Session Name"
        maxLength={NAME_MAX_LENGTH}
        value={value}
        aria-busy={busy || undefined}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Enter') {
            event.preventDefault();
            void save();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onEnd('cancelled');
          }
        }}
        onBlur={() => onEnd('blurred')}
      />
      {error && <ErrorMessage className="session-name-error">{RENAME_FAILED}</ErrorMessage>}
    </div>
  );
}
