import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { WarningDialog } from '../dialogs/WarningDialog';
import { checkDefaultKeys, checkPress, modifiersOfPress } from '../shortcut-key-check';
import {
  hasDefaultKeys,
  keyText,
  pressOf,
  type Shortcut,
  type ShortcutArea,
  type ShortcutId,
  type ShortcutKey,
  shortcutRows,
} from '../shortcut-map';
import { pageUserShortcutKeys, type UserShortcutKeysStore, useUserShortcutKeys } from '../user-shortcut-keys';

const GROUPS: readonly { area: ShortcutArea; title: string }[] = [
  { area: 'navigation', title: 'Navigation' },
  { area: 'sessions', title: 'Sessions' },
  { area: 'terminal', title: 'Terminal' },
  { area: 'general', title: 'General' },
];

const MAX_LISTED_KEYS = 4;

const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'OS', 'Super', 'Hyper']);

function KeyBadges({ shortcutKey }: { shortcutKey: ShortcutKey }) {
  const parts = [...shortcutKey.modifiers, keyText(shortcutKey)];
  return (
    <kbd className="shortcuts-key">
      {parts.map((part, index) => (
        <Fragment key={part}>
          {index > 0 && '+'}
          <kbd className="kbd-badge">{part}</kbd>
        </Fragment>
      ))}
    </kbd>
  );
}

function RowKeys({ keys }: { keys: readonly ShortcutKey[] }) {
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (keys.length > MAX_LISTED_KEYS && first && last) {
    return (
      <>
        <KeyBadges shortcutKey={first} /> … <KeyBadges shortcutKey={last} />
      </>
    );
  }
  return keys.map((key, index) => (
    <Fragment key={`${key.modifiers.join('+')}+${key.code}`}>
      {index > 0 && ' / '}
      <KeyBadges shortcutKey={key} />
    </Fragment>
  ));
}

export function ShortcutsSection({ store = pageUserShortcutKeys() }: { store?: UserShortcutKeysStore }) {
  const groupId = useId();
  useUserShortcutKeys(store);
  const rows = shortcutRows(store);
  const [editing, setEditing] = useState<ShortcutId | null>(null);
  const [messages, setMessages] = useState<Partial<Record<ShortcutId, string>>>({});
  const [confirmingRestoreAll, setConfirmingRestoreAll] = useState(false);
  const changeButtons = useRef(new Map<ShortcutId, HTMLButtonElement>());

  useEffect(() => {
    if (!editing) return;
    const finish = () => {
      setEditing(null);
      changeButtons.current.get(editing)?.focus();
    };
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.type !== 'keydown' || MODIFIER_KEYS.has(event.key)) return;
      if (event.key === 'Escape') {
        setMessages((current) => ({ ...current, [editing]: undefined }));
        finish();
        return;
      }
      const press = pressOf(event);
      const result = checkPress(editing, press, store);
      if (!result.accepted) {
        setMessages((current) => ({ ...current, [editing]: result.message }));
        return;
      }
      store.set(editing, { code: event.code, modifiers: modifiersOfPress(press), character: event.key });
      setMessages((current) => ({ ...current, [editing]: undefined }));
      finish();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
    };
  }, [editing, store]);

  const startEditing = (id: ShortcutId) => {
    setMessages((current) => ({ ...current, [id]: undefined }));
    setEditing(id);
  };

  const restoreDefault = (id: ShortcutId) => {
    setEditing(null);
    const result = checkDefaultKeys(id, store);
    if (result.accepted) {
      store.restore(id);
      // The button turns disabled, so the focus moves to the row's other action.
      changeButtons.current.get(id)?.focus();
    }
    setMessages((current) => ({ ...current, [id]: result.accepted ? undefined : result.message }));
  };

  const restoreAll = () => {
    store.restoreAll();
    setMessages({});
    setConfirmingRestoreAll(false);
  };

  const renderRow = (row: Shortcut) => {
    const message = messages[row.id];
    const messageId = `${groupId}-${row.id}-message`;
    return (
      <li key={row.id} className={editing === row.id ? 'shortcuts-row editing' : 'shortcuts-row'}>
        <span className="shortcuts-keys">
          {editing === row.id ? <span className="shortcuts-prompt">Press new keys, Esc to cancel</span> : <RowKeys keys={row.keys} />}
        </span>
        <span className="shortcuts-action">{row.action}</span>
        <span className="shortcuts-row-actions">
          <button
            ref={(element) => {
              if (element) changeButtons.current.set(row.id, element);
              else changeButtons.current.delete(row.id);
            }}
            type="button"
            className="button-neutral shortcuts-row-button"
            aria-label={`Change Keys: ${row.action}`}
            aria-describedby={message ? messageId : undefined}
            onClick={() => startEditing(row.id)}
          >
            Change Keys
          </button>
          <button
            type="button"
            className="button-neutral shortcuts-row-button"
            aria-label={`Restore Default: ${row.action}`}
            disabled={hasDefaultKeys(row.id, store)}
            onClick={() => restoreDefault(row.id)}
          >
            Restore Default
          </button>
        </span>
        {message && (
          <p id={messageId} className="shortcuts-row-message" role="alert">
            {message}
          </p>
        )}
      </li>
    );
  };

  return (
    <>
      <div className="shortcuts-toolbar">
        <button
          type="button"
          className="button-neutral"
          onClick={() => {
            setEditing(null);
            setConfirmingRestoreAll(true);
          }}
        >
          Restore All
        </button>
      </div>
      <div className="shortcuts-groups" role="region" aria-label="Shortcut List" tabIndex={0}>
        {GROUPS.map(({ area, title }) => (
          <section key={area} className="shortcuts-group" aria-labelledby={`${groupId}-${area}`}>
            <h3 id={`${groupId}-${area}`} className="section-label">
              {title}
            </h3>
            <ul className="shortcuts-rows">{rows.filter((row) => row.area === area).map(renderRow)}</ul>
          </section>
        ))}
      </div>
      {confirmingRestoreAll && (
        <WarningDialog
          accent="attn"
          title="Restore All Shortcuts"
          description="Every shortcut goes back to its default keys."
          primaryLabel="Restore All"
          onPrimary={restoreAll}
          onCancel={() => setConfirmingRestoreAll(false)}
        />
      )}
    </>
  );
}
