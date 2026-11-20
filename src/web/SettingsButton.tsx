import { SettingsIcon } from './icons/Icons';
import { commandKeysText } from './shortcut-map';
import { useUserShortcutKeys } from './user-shortcut-keys';

const NAME = 'Settings';

export function SettingsButton({ onOpen }: { onOpen: () => void }) {
  useUserShortcutKeys();
  return (
    <button type="button" className="vx-rail-btn" aria-label={NAME} aria-haspopup="dialog" onClick={onOpen}>
      <SettingsIcon />
      <span className="vx-tooltip vx-popup-glass" aria-hidden="true">
        {`${NAME} (${commandKeysText('open-shortcut-settings').join(' / ')})`}
      </span>
    </button>
  );
}
