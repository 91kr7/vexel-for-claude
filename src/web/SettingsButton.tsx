import { SettingsIcon } from './icons/Icons';

const NAME = 'Settings';

export function SettingsButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="vx-rail-btn" aria-label={NAME} aria-haspopup="dialog" onClick={onOpen}>
      <SettingsIcon />
      <span className="vx-tooltip" aria-hidden="true">
        {NAME}
      </span>
    </button>
  );
}
