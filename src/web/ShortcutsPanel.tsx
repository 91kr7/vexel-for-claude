import { Fragment, useId } from 'react';
import { Dialog } from './dialogs/Dialog';
import { SHORTCUTS_PANEL_CLASS } from './shortcut-keys';
import { SHORTCUTS, type ShortcutArea, type ShortcutKey } from './shortcut-map';

const GROUPS: readonly { area: ShortcutArea; title: string }[] = [
  { area: 'navigation', title: 'Navigation' },
  { area: 'sessions', title: 'Sessions' },
  { area: 'terminal', title: 'Terminal' },
  { area: 'general', title: 'General' },
];

const MAX_LISTED_KEYS = 4;

function keyText(key: ShortcutKey): string {
  if (key.command.kind === 'terminal') return key.code.toUpperCase();
  if (key.code === 'ArrowUp') return 'Up';
  if (key.code === 'ArrowDown') return 'Down';
  return key.code.replace(/^(Key|Digit)/, '');
}

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

export function ShortcutsPanel({ onClose }: { onClose: () => void }) {
  const groupId = useId();
  return (
    <Dialog title="Keyboard Shortcuts" onCancel={onClose} initialFocus="cancel" className={SHORTCUTS_PANEL_CLASS}>
      <div className="shortcuts-groups" role="region" aria-label="Shortcut List" tabIndex={0}>
        {GROUPS.map(({ area, title }) => (
          <section key={area} className="shortcuts-group" aria-labelledby={`${groupId}-${area}`}>
            <h3 id={`${groupId}-${area}`} className="section-label">
              {title}
            </h3>
            <ul className="shortcuts-rows">
              {SHORTCUTS.filter((row) => row.area === area).map((row) => (
                <li key={row.action} className="shortcuts-row">
                  <span className="shortcuts-keys">
                    <RowKeys keys={row.keys} />
                  </span>
                  <span className="shortcuts-action">{row.action}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
