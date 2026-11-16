import { SettingsIcon } from './icons/Icons';

const NAME = 'Settings';

export function SettingsButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="vx-surface-1 theme-switch settings-button" aria-label={NAME} title={NAME} aria-haspopup="dialog" onClick={onOpen}>
      <SettingsIcon />
    </button>
  );
}
