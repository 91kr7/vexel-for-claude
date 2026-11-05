import { useEffect, useRef, useState, type FormEvent } from 'react';

interface FolderListing {
  path: string;
  parent: string | null;
  folders: string[];
}

interface FolderChooserProps {
  onStarted: (sessionId: string) => void;
  onCancel: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  folder_not_found: 'La cartella non esiste.',
  invalid_path: 'Inserisci un percorso assoluto.',
  folder_not_readable: 'La cartella non è leggibile.',
};
const GENERIC_ERROR = 'Operazione non riuscita.';

async function errorMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return ERROR_MESSAGES[body?.error ?? ''] ?? GENERIC_ERROR;
}

function joinPath(folder: string, name: string): string {
  return folder === '/' ? `/${name}` : `${folder}/${name}`;
}

export function FolderChooser({ onStarted, onCancel }: FolderChooserProps) {
  const [listing, setListing] = useState<FolderListing | null>(null);
  const [pathInput, setPathInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const typingCount = useRef(0);

  const browse = async (path?: string) => {
    setError(null);
    const typingCountAtStart = typingCount.current;
    try {
      const query = path === undefined ? '' : `?path=${encodeURIComponent(path)}`;
      const response = await fetch(`/api/folders${query}`);
      if (typingCount.current !== typingCountAtStart) return;
      if (!response.ok) {
        setError(await errorMessage(response));
        return;
      }
      const next = (await response.json()) as FolderListing;
      if (typingCount.current !== typingCountAtStart) return;
      setListing(next);
      setPathInput(next.path);
    } catch {
      setError(GENERIC_ERROR);
    }
  };

  useEffect(() => {
    void browse();
  }, []);

  const start = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathInput.trim() }),
      });
      if (!response.ok) {
        setError(await errorMessage(response));
        return;
      }
      const { id } = (await response.json()) as { id: string };
      onStarted(id);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <form className="modal folder-chooser" onSubmit={start} aria-label="Scegli la cartella del progetto">
        <h2>Nuova sessione</h2>
        <label htmlFor="folder-path">Cartella del progetto</label>
        <input
          id="folder-path"
          type="text"
          value={pathInput}
          onChange={(event) => {
            typingCount.current += 1;
            setPathInput(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void browse(pathInput.trim());
            }
          }}
          autoFocus
        />
        <ul className="folder-list">
          {listing?.parent != null && (
            <li>
              <button type="button" onClick={() => void browse(listing.parent ?? undefined)}>
                ..
              </button>
            </li>
          )}
          {listing?.folders.map((name) => (
            <li key={name}>
              <button type="button" onClick={() => void browse(joinPath(listing.path, name))}>
                {name}
              </button>
            </li>
          ))}
        </ul>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            Annulla
          </button>
          <button type="submit" disabled={busy}>
            Avvia sessione
          </button>
        </div>
      </form>
    </div>
  );
}
