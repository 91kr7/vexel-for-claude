import { useEffect, useId, useRef, useState } from 'react';
import { Dialog } from '../dialogs/Dialog';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { ProgressIndicator } from '../feedback/ProgressIndicator';
import { FolderIcon, FolderPlusIcon } from '../icons/Icons';
import { Avatar, folderNameOf } from '../sessions/Avatar';

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

async function loadRecentFolders(): Promise<string[]> {
  const response = await fetch('/api/past-sessions');
  if (!response.ok) return [];
  const groups = (await response.json()) as { folder: string }[];
  return [...new Set(groups.map((group) => group.folder))];
}

interface FolderRowProps {
  id: string;
  name: string;
  path: string;
  onOpen: () => void;
}

function FolderRow({ id, name, path, onOpen }: FolderRowProps) {
  return (
    <li>
      <button type="button" className="dialog-row" aria-labelledby={`${id}-name`} aria-describedby={`${id}-path`} onClick={onOpen}>
        <span className="dialog-row-icon">
          <FolderIcon />
        </span>
        <span className="dialog-row-text">
          <span id={`${id}-name`} className="body-l dialog-row-title">
            {name}
          </span>
          <span id={`${id}-path`} className="mono dialog-row-detail">
            {path}
          </span>
        </span>
      </button>
    </li>
  );
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
  const [recentFolders, setRecentFolders] = useState<string[]>([]);
  const rowId = useId();

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
    let active = true;
    loadRecentFolders()
      .catch(() => [])
      .then((folders) => {
        if (active) setRecentFolders(folders);
      });
    return () => {
      active = false;
    };
  }, []);

  const chooseRecent = (folder: string) => {
    typingCount.current += 1;
    setPathInput(folder);
    void browse(folder);
  };

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
      icon={<FolderPlusIcon />}
      title="Nuova sessione"
      description="Scegli il progetto in cui avviare Claude Code."
      formName="Scegli la cartella del progetto"
      className="folder-chooser"
      primaryLabel="Avvia sessione"
      onPrimary={() => void start()}
      primaryBusy={busy}
      onCancel={onCancel}
    >
      <label className="folder-field">
        <span className="label-m folder-field-label">Cartella del progetto</span>
        <span className="folder-field-box">
          <FolderIcon />
          <input
            className="body-m folder-field-input"
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
        </span>
      </label>
      <div className="dialog-scroll">
        {recentFolders.length > 0 && (
          <>
            <p className="label-l dialog-section-heading">Recenti</p>
            <div className="dialog-rows" role="radiogroup" aria-label="Progetti recenti">
              {recentFolders.map((folder, index) => {
                const checked = pathInput.trim() === folder;
                const id = `${rowId}-recent-${index}`;
                return (
                  <label key={folder} className={checked ? 'dialog-row dialog-row-checked' : 'dialog-row'}>
                    <Avatar folder={folder} size="dialog" />
                    <span className="dialog-row-text">
                      <span id={`${id}-name`} className="body-l dialog-row-title">
                        {folderNameOf(folder)}
                      </span>
                      <span id={`${id}-path`} className="mono dialog-row-detail">
                        {folder}
                      </span>
                    </span>
                    <input
                      type="radio"
                      className="dialog-radio"
                      name={`${rowId}-recent`}
                      checked={checked}
                      aria-labelledby={`${id}-name`}
                      aria-describedby={`${id}-path`}
                      onChange={() => chooseRecent(folder)}
                    />
                  </label>
                );
              })}
            </div>
          </>
        )}
        <p className="label-l dialog-section-heading">Cartelle</p>
        <ul className="dialog-rows folder-list" ref={listRef}>
          {listing?.parent != null && (
            <FolderRow id={`${rowId}-parent`} name=".." path={listing.parent} onOpen={() => void browse(listing.parent ?? undefined)} />
          )}
          {listing?.folders.map((name, index) => (
            <FolderRow
              key={name}
              id={`${rowId}-folder-${index}`}
              name={name}
              path={joinPath(listing.path, name)}
              onOpen={() => void browse(joinPath(listing.path, name))}
            />
          ))}
        </ul>
        {listingFolder && <ProgressIndicator />}
      </div>
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </Dialog>
  );
}
