import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../dialogs/Dialog';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { ProgressIndicator } from '../feedback/ProgressIndicator';

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
const LISTING_FAILED = 'Lettura della cartella non riuscita.';
const START_FAILED = 'Avvio della sessione non riuscito.';

async function errorMessage(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return ERROR_MESSAGES[body?.error ?? ''] ?? fallback;
}

function joinPath(folder: string, name: string): string {
  return folder === '/' ? `/${name}` : `${folder}/${name}`;
}

export function FolderChooser({ onStarted, onCancel }: FolderChooserProps) {
  const [listing, setListing] = useState<FolderListing | null>(null);
  const [pathInput, setPathInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [listingFolder, setListingFolder] = useState(true);
  const typingCount = useRef(0);
  const browseCount = useRef(0);
  const listRef = useRef<HTMLUListElement>(null);

  const browse = async (path?: string) => {
    setError(null);
    setListingFolder(true);
    const typingCountAtStart = typingCount.current;
    const browseId = ++browseCount.current;
    try {
      const query = path === undefined ? '' : `?path=${encodeURIComponent(path)}`;
      const response = await fetch(`/api/folders${query}`);
      if (typingCount.current !== typingCountAtStart) return;
      if (!response.ok) {
        setError(await errorMessage(response, LISTING_FAILED));
        return;
      }
      const next = (await response.json()) as FolderListing;
      if (typingCount.current !== typingCountAtStart) return;
      setListing(next);
      setPathInput(next.path);
    } catch {
      setError(LISTING_FAILED);
    } finally {
      if (browseCount.current === browseId) setListingFolder(false);
    }
  };

  useEffect(() => {
    void browse();
  }, []);

  useEffect(() => {
    // The clicked folder button leaves the page with the old listing: keep the focus in the dialog.
    if (document.activeElement === document.body) listRef.current?.querySelector('button')?.focus();
  }, [listing]);

  const start = async () => {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathInput.trim() }),
      });
      if (!response.ok) {
        setError(await errorMessage(response, START_FAILED));
        return;
      }
      const { id } = (await response.json()) as { id: string };
      onStarted(id);
    } catch {
      setError(START_FAILED);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Nuova sessione"
      formName="Scegli la cartella del progetto"
      className="folder-chooser"
      primaryLabel="Avvia sessione"
      onPrimary={() => void start()}
      primaryBusy={busy}
      onCancel={onCancel}
    >
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
          const typed = pathInput.trim();
          if (event.key === 'Enter' && typed !== listing?.path) {
            event.preventDefault();
            void browse(typed);
          }
        }}
        autoFocus
      />
      <ul className="folder-list" ref={listRef}>
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
      {listingFolder && <ProgressIndicator />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </Dialog>
  );
}
