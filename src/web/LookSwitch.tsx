import { MacWindowIcon, WindowsLogoIcon } from './icons/Icons';
import { type LookStore, useLook } from './theme/look-store';

const NAME = 'Windows 11 look';

export function LookSwitch({ store }: { store?: LookStore }) {
  const { look, toggleLook } = useLook(store);
  const windows11 = look === 'windows11';
  return (
    <button type="button" className="vx-surface-1 theme-switch" aria-label={NAME} title={NAME} aria-pressed={windows11} onClick={toggleLook}>
      {windows11 ? <WindowsLogoIcon /> : <MacWindowIcon />}
    </button>
  );
}
