import { isDesktopWindow } from './desktop-bridge';
import { PlusIcon } from './icons/Icons';
import { ThemeSwitch } from './ThemeSwitch';
import { WindowButtons } from './WindowButtons';

interface TopBarProps {
  onNewSession: () => void;
}

export function TopBar({ onNewSession }: TopBarProps) {
  const desktop = isDesktopWindow();
  return (
    <header className={desktop ? 'top-bar top-bar-drag' : 'top-bar'}>
      <div className="top-bar-brand">
        {desktop && <WindowButtons />}
        <span className="logo-mark" aria-hidden="true">
          VX
        </span>
        <span className="top-bar-wordmark">
          <span className="top-bar-name">Vexel</span>
          <span className="top-bar-suffix">for Claude</span>
        </span>
      </div>
      <div className="top-bar-actions">
        <ThemeSwitch />
        <button type="button" className="button-primary button-bar" onClick={onNewSession}>
          <PlusIcon />
          New Session
        </button>
      </div>
    </header>
  );
}
