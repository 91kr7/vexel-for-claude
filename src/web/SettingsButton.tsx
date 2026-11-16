import { SettingsIcon } from './icons/Icons';
import { commandKeysText } from './shortcut-map';

const NAME = 'Settings';
const TOOLTIP = `${NAME} (${commandKeysText('open-shortcut-settings').join(' / ')})`;

export function SettingsButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="vx-rail-btn" aria-label={NAME} aria-haspopup="dialog" onClick={onOpen}>
      <SettingsIcon />
      <span className="vx-tooltip" aria-hidden="true">
        {TOOLTIP}
      </span>
    </button>
  );
}
